import { pool } from "../src/db.js";
import { runMigrations } from "../src/migrate.js";

try {
  await runMigrations(pool);
} finally {
  await pool.end();
}
