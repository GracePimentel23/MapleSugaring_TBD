import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { sweepOffline } from "./domain/ingest.js";
import { runMigrations } from "./migrate.js";

async function waitForDatabase(attempts = 30) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.log(`waiting for postgres (${error.message})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

await waitForDatabase();
if (config.migrateOnBoot) await runMigrations(pool);

const server = createApp().listen(config.port, () => {
  console.log(`worker listening on :${config.port}${config.ingestKey ? "" : " (ingest is open: INGEST_KEY not set)"}`);
  console.log(config.auth.enabled
    ? `sign-in: Google, domains ${config.auth.allowedDomains.join(", ") || "(none)"}, redirect ${config.auth.publicUrl}/api/auth/google/callback`
    : "sign-in: off (AUTH_PROVIDER not set), the API is open");
});

const sweeper = setInterval(() => {
  sweepOffline(pool).catch((error) => console.error("offline sweep failed", error.message));
}, 60_000);

function shutdown() {
  clearInterval(sweeper);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
