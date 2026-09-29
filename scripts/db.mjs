/** `npm run db`: just the local Postgres, until Ctrl+C. */
import { LOCAL_DATABASE_URL, startLocalPostgres } from "./local-postgres.mjs";

const { pg, fresh } = await startLocalPostgres();
console.log(`postgres ${fresh ? "created and " : ""}running: ${LOCAL_DATABASE_URL}`);
console.log("Ctrl+C to stop");

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
