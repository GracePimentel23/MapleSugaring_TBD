"""Send gateway lines to the TBD worker's POST /ingest in small batches.

Lines are POSTed as {"gateway": "GW-LAB", "lines": [{"type": "packet", ..., "received_at": "..."}]}
with the X-Ingest-Key header. If the app is unreachable (Wi-Fi down, cold start, wrong key), batches
go to a spool file and are re-sent once a batch gets through, so no reading is lost. The worker drops
lines it already has, so re-sending is safe. Standard library only. Adapted from
maplebackend/frontend/forwarder.py.
"""

import json
import os
import queue
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

FORWARD_KEYS = ("type", "n", "rssi", "snr", "len", "crc", "raw")
NODE_KINDS = ("live", "test", "nohx")


def to_line(event):
    """The gateway's own fields plus the time this computer heard it (lets the worker drop retries)."""
    line = {k: event[k] for k in FORWARD_KEYS if k in event}
    ts = event.get("ts", time.time())
    line["received_at"] = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="milliseconds")
    return line


def node_payload(event):
    """The node's packet inside a gateway "packet" line, or None if it is not one of our nodes
    (someone else's LoRa gear on 915 MHz, a corrupted packet)."""
    try:
        data = json.loads(event.get("raw") or "")
    except ValueError:
        return None
    if isinstance(data, dict) and isinstance(data.get("id"), str) and data.get("k") in NODE_KINDS:
        return data
    return None


class Forwarder:
    def __init__(self, url, gateway_id, ingest_key=None, spool_path=None, batch_size=50,
                 interval=5.0, status_every=60.0, timeout=15.0, log=print):
        self.url = url.rstrip("/") + "/ingest"
        self.gateway_id = gateway_id
        self.ingest_key = ingest_key
        self.spool_path = spool_path
        self.batch_size = batch_size
        self.interval = interval
        # The gateway prints a status line every 5 s. One a minute is enough to keep it "online"
        # in the app, and it keeps an idle bridge from using up the free hosting plan.
        self.status_every = status_every
        self.timeout = timeout
        self.log = log
        self.queue = queue.Queue(maxsize=10000)
        self.stats = {"sent": 0, "failed_batches": 0, "spooled": 0, "skipped": 0,
                      "last_error": None, "last_ok": None}
        self._last_status = 0.0
        self._stop = threading.Event()
        self._thread = None

    def submit(self, event):
        """Called from the serial thread with every parsed gateway line. Never blocks.
        Returns True if the line will be sent."""
        kind = event.get("type")
        if kind == "packet":
            if not event.get("crc", True) or node_payload(event) is None:
                self.stats["skipped"] += 1
                return False
        elif kind == "status":
            now = event.get("ts", time.time())
            if now - self._last_status < self.status_every:
                return False
            self._last_status = now
        elif kind != "boot":
            return False
        try:
            self.queue.put_nowait(to_line(event))
        except queue.Full:
            self._spool([to_line(event)])
        return True

    def start(self):
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return self

    def stop(self, flush=True):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=self.timeout + 2)
        if flush:
            self._drain_once()

    # ------------------------------------------------------------------ internals

    def _post(self, lines):
        body = json.dumps({"gateway": self.gateway_id, "lines": lines}).encode()
        headers = {"Content-Type": "application/json"}
        if self.ingest_key:
            headers["X-Ingest-Key"] = self.ingest_key
        request = urllib.request.Request(self.url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read() or b"{}")

    def _send(self, lines):
        try:
            result = self._post(lines)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:200]
            try:
                detail = json.loads(detail).get("error", detail)
            except (ValueError, AttributeError):
                pass
            hint = " (check INGEST_KEY in bridge.env)" if error.code == 401 else ""
            return self._failed("HTTP %d: %s%s" % (error.code, detail, hint))
        except (urllib.error.URLError, OSError, ValueError) as error:
            return self._failed(str(getattr(error, "reason", error)))
        self.stats["sent"] += len(lines)
        self.stats["last_ok"] = time.time()
        if self.stats["last_error"]:
            self.log("App reachable again")
        self.stats["last_error"] = None
        return result or {"ok": True}

    def _failed(self, message):
        self.stats["failed_batches"] += 1
        if self.stats["last_error"] != message:
            self.log("Sending to %s failed: %s. Saving readings and retrying." % (self.url, message))
        self.stats["last_error"] = message
        return None

    def _spool(self, lines):
        if not self.spool_path:
            return
        with open(self.spool_path, "a", encoding="utf-8") as f:
            for line in lines:
                f.write(json.dumps(line) + "\n")
        self.stats["spooled"] += len(lines)

    def _retry_spool(self):
        """Resend spooled lines once the app answers again."""
        if not self.spool_path or not os.path.exists(self.spool_path):
            return
        with open(self.spool_path, encoding="utf-8") as f:
            lines = [json.loads(text) for text in f if text.strip()]
        for start in range(0, len(lines), self.batch_size):
            if not self._send(lines[start:start + self.batch_size]):
                # Keep what is left for next time.
                with open(self.spool_path, "w", encoding="utf-8") as f:
                    for line in lines[start:]:
                        f.write(json.dumps(line) + "\n")
                return
        os.remove(self.spool_path)
        self.log("Sent %d saved readings" % len(lines))

    def _drain_once(self):
        lines = []
        while len(lines) < self.batch_size:
            try:
                lines.append(self.queue.get_nowait())
            except queue.Empty:
                break
        if not lines:
            return 0
        result = self._send(lines)
        if result:
            packets = sum(1 for line in lines if line.get("type") == "packet")
            if packets:
                self.log("  -> sent %d packet%s to the app (stored %s)"
                         % (packets, "" if packets == 1 else "s", result.get("stored", "?")))
            self._retry_spool()
        else:
            self._spool(lines)
        return len(lines)

    def _run(self):
        while not self._stop.is_set():
            if self._drain_once() < self.batch_size:
                self._stop.wait(self.interval)
