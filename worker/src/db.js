import pg from "pg";
import { config } from "./config.js";

// numeric and bigint come back as strings by default; everything we store fits in a double.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number.parseFloat(value));
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number.parseInt(value, 10));
// Keep DATE columns as "YYYY-MM-DD" instead of a local-midnight Date.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

// On Vercel every function instance has its own pool, so keep each one small and let idle clients go
// (use the pooled connection string from Neon there).
export const pool = new pg.Pool(
  config.onVercel
    ? { connectionString: config.databaseUrl, max: 3, idleTimeoutMillis: 10_000 }
    : { connectionString: config.databaseUrl, max: 10 },
);

pool.on("error", (error) => {
  console.error("postgres pool error", error.message);
});

/** Run fn inside a transaction on one client. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
