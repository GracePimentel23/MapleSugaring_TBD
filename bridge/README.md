# Gateway bridge

Runs on whatever computer the LoRa32 **gateway** board is plugged into. It reads the board's USB serial
output and sends every reading to the TBD app, so the dashboard follows the real scale.

```
LC01 node ~LoRa~> gateway board -USB-> python bridge.py -> POST <TBD_URL>/ingest -> dashboard
```

Needs Python 3.9+ and nothing else on Windows or Linux (pyserial is used when installed). On a Mac also
`python3 -m pip install pyserial`.

## Raspberry Pi as the gateway

Copy this `bridge/` folder to the Pi (a USB stick or `scp -r bridge pi@<pi-address>:~/`), plug the gateway
board into a USB port, then on the Pi:

```bash
cd ~/bridge
cp bridge.example.env bridge.env
nano bridge.env          # TBD_URL=https://tbd-api.vercel.app, INGEST_KEY=..., GATEWAY_ID=GW-PI
bash pi-setup.sh         # installs pyserial and a service that starts the bridge at boot
journalctl -u maple-bridge -f
```

The service restarts the bridge if it stops and after a reboot. If ours is the only board on the Pi it finds
it by itself; on a Pi shared with another team, set `SERIAL_PORT=/dev/serial/by-id/...` to our gateway so
the bridge never opens their board (`pi-setup.sh` stops and lists the names when more than one is plugged in). A Pi on Wi-Fi only needs to reach the internet; readings are saved in
`spool.jsonl` while it is offline.

## Run it

```powershell
cd bridge
copy bridge.example.env bridge.env     # once; then set TBD_URL and INGEST_KEY in bridge.env
python bridge.py
```

It finds the gateway's COM port by itself (it skips the load cell node if that is plugged in too) and
prints one line per packet:

```
Reading the gateway on COM8
14:41:48  LC01  0.686 kg  -21.0 dBm
  -> sent 1 packet to the app (stored 1)
```

Close the maplebackend `server.py` or any serial monitor first: only one program can hold the port.

| Command | Does |
|---|---|
| `python bridge.py --port COM6` | use this port instead of searching |
| `python bridge.py --dry-run` | read and print, send nothing (no settings needed) |
| `python bridge.py --demo` | no boards: sends a fake node `LC-DEMO` that slowly fills |
| `python bridge.py --list` | list serial ports |

## Settings (`bridge.env`)

| Name | What |
|---|---|
| `TBD_URL` | The API: the `tbd-api` Vercel URL, or `http://localhost:4000` with `npm run dev` |
| `INGEST_KEY` | The bridge key: the app's `INGEST_KEY`, or a per-gateway key from `npm run gateway-key -- create GW-NAME` (see docs/VERCEL.md) |
| `GATEWAY_ID` | Optional name for this gateway (default `GW-<computer name>`; a per-gateway key overrides it) |
| `SERIAL_PORT` | Optional, e.g. `COM6` |
| `FORWARD_INTERVAL` | Optional seconds between checks for readings to send, default 1 (a request only goes out when there is something to send) |

`bridge.env` is gitignored; never commit a key. Environment variables and command line flags
(`--url`, `--key`, ...) override it.

## When the app is unreachable

Readings are saved to `bridge/spool.jsonl` and sent once the app answers again, so nothing is lost while
Wi-Fi is down. A wrong key shows as `HTTP 401 ... (check INGEST_KEY in bridge.env)`; fix it and restart,
and the saved readings go out. Only packets from our nodes are sent (other LoRa devices on 915 MHz are
ignored), plus one gateway status line a minute so the app knows the gateway is alive.

Tests: `python -m unittest discover -s bridge/tests -v` from the repo root.
