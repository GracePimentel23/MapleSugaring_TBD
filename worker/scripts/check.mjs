/**
 * `npm run build` for the worker. The shared compose file runs `npm run build` on every Node service;
 * the worker is plain JavaScript, so "building" means proving every module parses and the app assembles.
 *
 * On Vercel the build is also where migrations run, since functions have no boot step. It uses
 * DATABASE_URL_UNPOOLED (set by the Neon integration) when there is one, else DATABASE_URL.
 */
const migrateUrl = process.env.VERCEL ? process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL : null;
if (process.env.VERCEL && !migrateUrl) {
  throw new Error("DATABASE_URL is not set for this Vercel environment: connect the Neon database to the project");
}
process.env.DATABASE_URL = migrateUrl ?? process.env.DATABASE_URL ?? "postgres://build:build@127.0.0.1:1/build"; // never connected to locally
const { createApp } = await import("../src/app.js");
createApp();
const { pool } = await import("../src/db.js");
if (migrateUrl) {
  const { runMigrations } = await import("../src/migrate.js");
  await runMigrations(pool);
}
await pool.end();
console.log("worker build check ok");
