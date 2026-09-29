#!/usr/bin/env bash
# One-time setup on the VM: make `git pull` in this repo redeploy the app.
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ln -sf ../../deploy/post-merge "$repo/.git/hooks/post-merge"
chmod +x "$repo/deploy/post-merge" "$repo/deploy/update.sh"
echo "installed: git pull in $repo now runs deploy/update.sh"
