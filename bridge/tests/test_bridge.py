"""Bridge: which gateway lines get sent, batching, the key header, and spooling while the app is down.

    python -m unittest discover -s bridge/tests -v
"""

import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bridge import describe, load_env_file, parse_line  # noqa: E402
from forwarder import Forwarder, to_line  # noqa: E402

PACKET = '{"type":"packet","n":3,"rssi":-40.0,"snr":9.5,"len":58,"crc":true,"raw":"{\\"id\\":\\"LC01\\",\\"k\\":\\"live\\",\\"s\\":2,\\"w\\":3.412}"}'
FOREIGN = '{"type":"packet","n":4,"rssi":-110.0,"snr":-4.0,"len":20,"crc":true,"raw":"{\\"Node_Code\\":\\"X\\"}"}'
STATUS = '{"type":"status","role":"gateway","uptime":30,"radio":"ok","rx":12}'


class FakeApi:
    def __init__(self, status=200):
        self.bodies, self.headers = [], []
        api = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                api.bodies.append(body)
                api.headers.append(dict(self.headers))
                out = json.dumps({"stored": len(body["lines"])} if status == 200 else {"error": "missing X-Ingest-Key"}).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(out)))
                self.end_headers()
                self.wfile.write(out)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = "http://127.0.0.1:%d" % self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()


quiet = lambda *_: None  # noqa: E731


class BridgeTest(unittest.TestCase):
    def test_line_keeps_gateway_fields_only(self):
        line = to_line(parse_line(PACKET, now=1_800_000_000))
        self.assertEqual(set(line), {"type", "n", "rssi", "snr", "len", "crc", "raw", "received_at"})
        self.assertTrue(line["received_at"].startswith("2027-01-15T08:00:00"))

    def test_only_our_packets_and_one_status_a_minute_are_sent(self):
        fwd = Forwarder("http://127.0.0.1:9", "GW-TEST", log=quiet)
        self.assertTrue(fwd.submit(parse_line(PACKET)))
        self.assertFalse(fwd.submit(parse_line(FOREIGN)))
        self.assertFalse(fwd.submit({"type": "selftest", "ts": 0}))
        self.assertTrue(fwd.submit(parse_line(STATUS, now=1000)))
        self.assertFalse(fwd.submit(parse_line(STATUS, now=1005)))
        self.assertTrue(fwd.submit(parse_line(STATUS, now=1061)))
        self.assertEqual(fwd.queue.qsize(), 3)

    def test_batches_and_sends_key(self):
        api = FakeApi()
        try:
            fwd = Forwarder(api.url, "GW-TEST", ingest_key="k1", interval=0.05, log=quiet)
            for _ in range(3):
                fwd.submit(parse_line(PACKET))
            fwd.start()
            fwd.stop()
            self.assertEqual(sum(len(body["lines"]) for body in api.bodies), 3)
            self.assertEqual(api.bodies[0]["gateway"], "GW-TEST")
            self.assertEqual(api.headers[0].get("X-Ingest-Key"), "k1")
        finally:
            api.close()

    def test_wrong_key_is_spooled_and_resent_later(self):
        with tempfile.TemporaryDirectory() as tmp:
            spool = os.path.join(tmp, "spool.jsonl")
            refused = FakeApi(status=401)
            try:
                logs = []
                fwd = Forwarder(refused.url, "GW-TEST", spool_path=spool, log=logs.append)
                fwd.submit(parse_line(PACKET))
                fwd._drain_once()
                self.assertEqual(fwd.stats["spooled"], 1)
                self.assertIn("INGEST_KEY", logs[0])
            finally:
                refused.close()

            api = FakeApi()
            try:
                fwd = Forwarder(api.url, "GW-TEST", spool_path=spool, log=quiet)
                fwd.submit(parse_line(PACKET))
                fwd._drain_once()
                self.assertEqual(sum(len(body["lines"]) for body in api.bodies), 2)
                self.assertFalse(os.path.exists(spool))
            finally:
                api.close()

    def test_console_lines(self):
        self.assertIn("LC01  3.412 kg", describe(parse_line(PACKET)))
        self.assertIn("other LoRa device", describe(parse_line(FOREIGN)))
        self.assertIsNone(describe(parse_line(STATUS)))
        self.assertIsNone(parse_line("[TX] debug text"))

    def test_env_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "bridge.env")
            with open(path, "w") as f:
                f.write("# comment\nTBD_URL=https://x.vercel.app\nINGEST_KEY='abc'\n\n")
            self.assertEqual(load_env_file(path), {"TBD_URL": "https://x.vercel.app", "INGEST_KEY": "abc"})


if __name__ == "__main__":
    unittest.main()
