"""Gateway bridge: reads the LoRa32 GATEWAY board over USB serial and sends every reading to the
TBD app, so the dashboard shows what the load cells are doing.

    python bridge.py                  # settings from bridge.env, finds the gateway COM port itself
    python bridge.py --port COM6      # name the port
    python bridge.py --dry-run        # read and print, send nothing
    python bridge.py --demo           # no boards: send a fake LC-DEMO node that slowly fills
    python bridge.py --list           # list serial ports

Settings (command line beats environment variables, which beat bridge.env):
    TBD_URL       where the API is, e.g. https://tbd-api.vercel.app or http://localhost:4000
    INGEST_KEY    the bridge key (npm run gateway-key -- create GW-LAB, or the app's INGEST_KEY)
    GATEWAY_ID    the name this gateway reports as (default GW-<computer name>; a per-gateway key
                  overrides it with the name the key was made for)
    SERIAL_PORT   e.g. COM6 or /dev/ttyUSB0 (default: auto-detect)

Standard library only (pyserial is used if installed, and is needed on Mac/Linux).
"""

import argparse
import json
import os
import random
import socket
import sys
import threading
import time

from forwarder import Forwarder, node_payload
import serial_io

HERE = os.path.dirname(os.path.abspath(__file__))
SILENCE_RECONNECT_S = 15


def load_env_file(path):
    """KEY=VALUE lines; # comments and blank lines ignored. Missing file means no settings."""
    values = {}
    if not os.path.exists(path):
        return values
    with open(path, encoding="utf-8") as f:
        for text in f:
            text = text.strip()
            if not text or text.startswith("#") or "=" not in text:
                continue
            key, value = text.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def parse_line(text, now=None):
    """One serial line as a dict with "ts", or None for blank lines and non-JSON debug output."""
    text = text.strip()
    if not text:
        return None
    try:
        event = json.loads(text)
    except ValueError:
        return None
    if not isinstance(event, dict) or "type" not in event:
        return None
    event["ts"] = time.time() if now is None else now
    return event


def describe(event):
    """One readable line for the console, or None for lines not worth printing."""
    stamp = time.strftime("%H:%M:%S", time.localtime(event["ts"]))
    kind = event.get("type")
    if kind == "packet":
        radio = "%s dBm" % event.get("rssi")
        if not event.get("crc", True):
            return "%s  (corrupted packet, CRC failed, %s)" % (stamp, radio)
        node = node_payload(event)
        if node is None:
            return "%s  (packet from some other LoRa device, ignored, %s)" % (stamp, radio)
        if node.get("k") == "nohx":
            return "%s  %s  no load cell amplifier detected  %s" % (stamp, node["id"], radio)
        return "%s  %s  %s kg  %s" % (stamp, node["id"], node.get("w"), radio)
    if kind == "boot":
        return "%s  gateway booted (radio %s, %s MHz)" % (stamp, event.get("radio"), event.get("freq"))
    if kind == "status" and event.get("radio") not in (None, "ok"):
        return "%s  gateway radio problem: %s" % (stamp, event.get("radio"))
    return None


def handle(event, forwarder):
    text = describe(event)
    if forwarder:
        forwarder.submit(event)
    if text:
        print(text, flush=True)


def serial_loop(port, forwarder, stop):
    """Read the gateway forever, reconnecting if the board is unplugged or replugged."""
    while not stop.is_set():
        target = port
        if not target:
            print("Looking for the gateway board:")
            target = serial_io.find_gateway(log=print)
            if not target:
                print("Gateway board not found. Is it plugged in (data cable) and flashed? Retrying...")
                stop.wait(3)
                continue
        try:
            s = serial_io.open_port(target)
        except (OSError, RuntimeError) as e:
            print("Serial:", e)
            stop.wait(3)
            continue
        print("Reading the gateway on %s" % target, flush=True)
        last_line = time.time()
        try:
            while not stop.is_set():
                line = s.readline()
                if line is None:
                    # The gateway prints status every 5 s, so silence means the port went stale.
                    if time.time() - last_line > SILENCE_RECONNECT_S:
                        raise OSError("no data from %s for %d s, reconnecting" % (target, SILENCE_RECONNECT_S))
                    continue
                last_line = time.time()
                event = parse_line(line)
                if event:
                    handle(event, forwarder)
        except OSError as e:
            print("Serial:", e)
        finally:
            s.close()
        stop.wait(2)


def demo_loop(forwarder, stop):
    """No hardware: a node called LC-DEMO that fills slowly and gets emptied now and then."""
    handle(parse_line('{"type":"boot","role":"gateway","radio":"ok","freq":915.0}'), forwarder)
    seq, weight = 0, 0.5
    while not stop.is_set():
        seq += 1
        weight = 0.3 if weight > 9 else weight + random.uniform(0.02, 0.12)
        raw = json.dumps({"id": "LC-DEMO", "k": "live", "s": seq, "w": round(weight, 3),
                          "r": int(weight * 42000), "hx": 1}, separators=(",", ":"))
        handle(parse_line(json.dumps({"type": "packet", "n": seq, "rssi": round(random.uniform(-80, -40), 1),
                                      "snr": round(random.uniform(5, 11), 2), "len": len(raw),
                                      "crc": True, "raw": raw})), forwarder)
        handle(parse_line('{"type":"status","role":"gateway","radio":"ok"}'), forwarder)
        stop.wait(5)


def main(argv=None):
    env = load_env_file(os.path.join(HERE, "bridge.env"))
    setting = lambda name, default=None: os.environ.get(name) or env.get(name) or default  # noqa: E731

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=setting("TBD_URL"), help="API base URL (TBD_URL)")
    ap.add_argument("--key", default=setting("INGEST_KEY"), help="bridge key (INGEST_KEY)")
    ap.add_argument("--gateway-id", default=setting("GATEWAY_ID", "GW-" + socket.gethostname().upper()[:40]))
    ap.add_argument("--port", default=setting("SERIAL_PORT"), help="gateway serial port (default: auto-detect)")
    ap.add_argument("--interval", type=float, default=float(setting("FORWARD_INTERVAL", "5")),
                    help="seconds between sends (default 5)")
    ap.add_argument("--dry-run", action="store_true", help="read and print only, send nothing")
    ap.add_argument("--demo", action="store_true", help="fake node LC-DEMO, no boards needed")
    ap.add_argument("--list", action="store_true", help="list serial ports and exit")
    args = ap.parse_args(argv)

    if args.list:
        for p, d in serial_io.list_ports():
            print(p, "-", d)
        return 0

    forwarder = None
    if not args.dry_run:
        if not args.url:
            print("Set TBD_URL in bridge/bridge.env (copy bridge.example.env), or pass --url, or use --dry-run.")
            return 2
        forwarder = Forwarder(args.url, args.gateway_id, args.key, interval=args.interval,
                              spool_path=os.path.join(HERE, "spool.jsonl"),
                              log=lambda text: print(text, flush=True)).start()
        print("Sending to %s as %s%s" % (forwarder.url, args.gateway_id, "" if args.key else " (no INGEST_KEY set)"))

    stop = threading.Event()
    if args.demo:
        worker = threading.Thread(target=demo_loop, args=(forwarder, stop), daemon=True)
    else:
        worker = threading.Thread(target=serial_loop, args=(args.port, forwarder, stop), daemon=True)
    worker.start()
    print("Ctrl+C to stop", flush=True)
    try:
        while worker.is_alive():
            worker.join(0.5)
    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        stop.set()
        if forwarder:
            forwarder.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
