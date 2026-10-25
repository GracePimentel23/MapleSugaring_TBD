#!/usr/bin/env bash
# Sets up a Raspberry Pi (or any Debian/Ubuntu box) as the gateway: run from the bridge folder.
#   bash pi-setup.sh          installs pyserial, serial port access and a service that starts at boot
# Afterwards: journalctl -u maple-bridge -f   shows what it sends; sudo systemctl restart maple-bridge
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
USER_NAME="$(id -un)"

if [ ! -f "$HERE/bridge.env" ]; then
  cp "$HERE/bridge.example.env" "$HERE/bridge.env"
  echo "Made bridge.env from bridge.example.env. Set TBD_URL, INGEST_KEY and GATEWAY_ID in it, then run this again."
  exit 1
fi
if ! grep -q '^TBD_URL=https\?://' "$HERE/bridge.env"; then
  echo "Set TBD_URL in $HERE/bridge.env first (the tbd-api URL)."
  exit 1
fi

# On a shared Pi the bridge must not search the ports: opening another team's board can reset it
# or steal its serial data. With more than one USB serial device, SERIAL_PORT has to name ours.
devices="$(ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null | wc -l)"
if [ "$devices" -gt 1 ] && ! grep -q '^SERIAL_PORT=/dev/' "$HERE/bridge.env"; then
  echo "More than one USB serial device is plugged in. Set SERIAL_PORT in bridge.env to our gateway,"
  echo "using its stable name from this list (it survives replugging):"
  ls -l /dev/serial/by-id/ 2>/dev/null || ls /dev/ttyUSB* /dev/ttyACM*
  exit 1
fi

# pyserial from apt (pip refuses system installs on Raspberry Pi OS Bookworm). The bridge also works
# without it, but pyserial's port detection is the better tested path.
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-serial

# Serial ports belong to the dialout group.
if ! id -nG "$USER_NAME" | grep -qw dialout; then
  sudo usermod -aG dialout "$USER_NAME"
  echo "Added $USER_NAME to dialout (the service gets it right away; log out and in for your own shell)."
fi

sudo tee /etc/systemd/system/maple-bridge.service >/dev/null <<UNIT
[Unit]
Description=Maple Sugaring gateway bridge (LoRa gateway USB serial to the TBD API)
Wants=network-online.target
After=network-online.target

[Service]
User=$USER_NAME
SupplementaryGroups=dialout
WorkingDirectory=$HERE
ExecStart=/usr/bin/python3 -u $HERE/bridge.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now maple-bridge
echo
echo "Running. Plug the gateway board in (it is found by itself). Logs: journalctl -u maple-bridge -f"
