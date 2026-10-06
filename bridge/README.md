# Gateway bridge

Runs on whatever computer the LoRa32 **gateway** board is plugged into. It reads the board's USB serial
output and sends every reading to the TBD app, so the dashboard follows the real scale.

```
LC01 node ~LoRa~> gateway board -USB-> python bridge.py -> POST <TBD_URL>/ingest -> dashboard
```

Needs Python 3.9+ and nothing else on Windows. On Mac/Linux also `python3 -m pip install pyserial`.

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
| `FORWARD_INTERVAL` | Optional seconds between sends, default 5 |

`bridge.env` is gitignored; never commit a key. Environment variables and command line flags
(`--url`, `--key`, ...) override it.

## When the app is unreachable

Readings are saved to `bridge/spool.jsonl` and sent once the app answers again, so nothing is lost while
Wi-Fi is down. A wrong key shows as `HTTP 401 ... (check INGEST_KEY in bridge.env)`; fix it and restart,
and the saved readings go out. Only packets from our nodes are sent (other LoRa devices on 915 MHz are
ignored), plus one gateway status line a minute so the app knows the gateway is alive.

Tests: `python -m unittest discover -s bridge/tests -v` from the repo root.
