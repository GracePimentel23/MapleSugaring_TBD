#!/usr/bin/env bash
# Rebuild and restart the TBD containers from what is checked out in this repo.
#
#   deploy/update.sh            rebuild what changed since the last deploy (web, worker or both)
#   deploy/update.sh all        rebuild everything
#
# Runs automatically after every `git pull` once deploy/install-hook.sh has been run.
# COMPOSE_FILE picks the stack (default: the TBD preview). Point it at the shared file once
# the maintainer's /srv/msdocker stack is up, e.g. in deploy/.env: COMPOSE_FILE=/srv/msdocker/docker-compose.yml
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$repo/deploy/.env" ] && . "$repo/deploy/.env"
compose_file="${COMPOSE_FILE:-$repo/deploy/preview.compose.yml}"
web_service="${WEB_SERVICE:-web}"
worker_service="${WORKER_SERVICE:-worker}"
stamp="$repo/deploy/.last-deploy"   # commit that is currently running (gitignored)

cd "$repo"
head="$(git rev-parse HEAD)"
services=()
if [ "${1:-}" = "all" ] || [ ! -f "$stamp" ] || ! git cat-file -e "$(cat "$stamp")^{commit}" 2>/dev/null; then
  services=("$worker_service" "$web_service")
else
  changed="$(git diff --name-only "$(cat "$stamp")" "$head")"
  grep -q '^worker/' <<<"$changed" && services+=("$worker_service")
  grep -q '^web/' <<<"$changed" && services+=("$web_service")
  grep -q '^deploy/' <<<"$changed" && services=("$worker_service" "$web_service")
fi

if [ ${#services[@]} -eq 0 ]; then
  echo "[deploy] nothing in web/, worker/ or deploy/ changed since $(cut -c1-7 "$stamp"); app left as is"
  echo "$head" > "$stamp"
  exit 0
fi

echo "[deploy] $(git log -1 --format='%h %s') -> rebuilding: ${services[*]}"
sudo docker compose -f "$compose_file" up -d --build "${services[@]}"
echo "$head" > "$stamp"

# Wait for the health checks so a broken build is obvious right here.
for service in "${services[@]}"; do
  id="$(sudo docker compose -f "$compose_file" ps -q "$service")"
  for _ in $(seq 1 40); do
    status="$(sudo docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")"
    [ "$status" = "healthy" ] && break
    sleep 3
  done
  echo "[deploy] $service: $status"
done
