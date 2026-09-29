/**
 * Forward-only migrations: every migrations/*.sql file runs once, in filename order, each in its own
 * transaction, and is recorded in schema_migrations. Never edit a file that has run on the VM; add a new one.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function runMigrations(pool, log = console.log) {
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        version    text primary key,
        applied_at timestamptz not null default current_timestamp
      )`);
    const { rows } = await client.query("select version from schema_migrations");
    const applied = new Set(rows.map((row) => row.version));
    const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
    const pending = files.filter((name) => !applied.has(name));

    for (const file of pending) {
      const sql = await readFile(join(migrationsDir, file), "utf8");
      log(`applying migration ${file}`);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migrations (version) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw new Error(`migration ${file} failed: ${error.message}`, { cause: error });
      }
    }
    if (!pending.length) log(`schema up to date (${applied.size} migrations)`);
    return pending;
  } finally {
    client.release();
  }
}
