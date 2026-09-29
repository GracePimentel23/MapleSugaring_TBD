# Getting changes onto the VM

VM: `maplesugaring01.webdev.gccis.rit.edu`, SSH port `22010`, user `student` (ask the team for the password).
The app lives in `/srv/TBD`. Branch: `backend-api`.

## 1. Normal flow

1. Commit and push your change to `backend-api`.
2. SSH in:
   ```
   ssh -p 22010 student@maplesugaring01.webdev.gccis.rit.edu
   ```
3. Pull:
   ```
   cd /srv/TBD
   git pull
   ```
4. That's it. The pull rebuilds whatever changed (`web/`, `worker/` or both) and restarts it.
   Enter the sudo password when asked. A web rebuild takes a few minutes.
5. It worked when the last lines say:
   ```
   [deploy] web: healthy
   [deploy] worker: healthy
   ```

Pull without rebuilding: `SKIP_DEPLOY=1 git pull`
Rebuild everything by hand: `deploy/update.sh all`

## 2. Look at it

- On the VM desktop: open http://localhost:3100
- From your laptop: run this, leave it open, then open http://localhost:3100
  ```
  ssh -N -L 3100:localhost:3100 -p 22010 student@maplesugaring01.webdev.gccis.rit.edu
  ```
- Quick check from the VM terminal:
  ```
  curl localhost:3100/health        # web
  curl localhost:3100/api/health    # worker + database
  ```

## 3. Logs, status, rollback

Run these from `/srv/TBD`:

```
sudo docker compose -f deploy/preview.compose.yml ps              # status
sudo docker compose -f deploy/preview.compose.yml logs -f web     # web logs (Ctrl+C to stop)
sudo docker compose -f deploy/preview.compose.yml logs -f worker  # API logs
```

Roll back to an older commit:

```
git log --oneline            # find the good commit
git checkout <commit>
deploy/update.sh all
```

Go back to the latest afterwards: `git checkout backend-api && git pull`

Database changes go in a new file `worker/migrations/00N_name.sql`. They run when the worker starts.
Never edit a migration that already ran.

## 4. Prod: what is and isn't set up

Set up:
- The code is at `/srv/TBD` and pull-to-deploy works.
- A TBD-only stack runs on the VM (`TBD_PREVIEW_*` containers, own database). The site is only reachable at `localhost:3100` on the VM.

Not set up yet (waiting on the Docker maintainer):
- The shared stack in `/srv/msdocker` can't start yet (the 7BS part and the router are missing).
- The public address https://maplesugaring01.webdev.gccis.rit.edu doesn't point at our app yet.

When the shared stack is ready:
1. Create `/srv/TBD/deploy/.env` with:
   ```
   COMPOSE_FILE=/srv/msdocker/docker-compose.yml
   WEB_SERVICE=tbd-web
   WORKER_SERVICE=tbd-worker
   ```
2. Stop the preview: `sudo docker compose -f deploy/preview.compose.yml down`
3. `deploy/update.sh all`

After that, `git pull` deploys to the shared stack the same way. Use `/srv/msdocker/docker-compose.yml` in place of `deploy/preview.compose.yml` in the log commands.
