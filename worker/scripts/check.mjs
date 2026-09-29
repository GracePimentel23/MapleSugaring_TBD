/**
 * `npm run build` for the worker. The shared compose file runs `npm run build` on every Node service;
 * the worker is plain JavaScript, so "building" means proving every module parses and the app assembles.
 */
process.env.DATABASE_URL ??= "postgres://build:build@127.0.0.1:1/build"; // never connected to
const { createApp } = await import("../src/app.js");
createApp();
const { pool } = await import("../src/db.js");
await pool.end();
console.log("worker build check ok");
