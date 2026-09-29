/**
 * `npm run dev`: everything, the way the VM runs it but on this PC.
 *   1. local Postgres on :5433 (seeded with demo data the first time)
 *   2. worker on :4000   (migrations run on boot)
 *   3. web on :3000      (Next dev server, WORKER_URL pointed at the worker; WEB_PORT to change)
 * Ctrl+C stops all three.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_DATABASE_URL, startLocalPostgres } from "./local-postgres.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER_PORT = process.env.WORKER_PORT ?? "4000";
const WORKER_URL = `http://localhost:${WORKER_PORT}`;
const WEB_PORT = process.env.WEB_PORT ?? "3000";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const { pg, fresh } = await startLocalPostgres();
console.log(`[db] postgres running: ${LOCAL_DATABASE_URL}`);

const children = [];
function run(name, args, cwd, env) {
  const child = spawn(npm, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  const prefix = (chunk) =>
    chunk.toString().split(/\r?\n/).filter(Boolean).map((line) => `[${name}] ${line}`).join("\n") + "\n";
  child.stdout.on("data", (chunk) => process.stdout.write(prefix(chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefix(chunk)));
  children.push(child);
  return child;
}

const workerEnv = { DATABASE_URL: LOCAL_DATABASE_URL, PORT: WORKER_PORT };
if (fresh) {
  await new Promise((resolve) => run("seed", ["run", "seed"], join(root, "worker"), workerEnv).on("exit", resolve));
}
run("worker", ["run", "dev"], join(root, "worker"), workerEnv);
run("web", ["run", "dev", "--", "-p", WEB_PORT], join(root, "web"), { WORKER_URL });
console.log(`[dev] open http://localhost:${WEB_PORT}  (API: ${WORKER_URL}/health)`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  await pg.stop().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
