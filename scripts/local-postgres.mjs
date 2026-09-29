/**
 * A real Postgres 17 for local development, run from npm (no Docker or installer needed).
 * Data lives in ./.pgdata (gitignored). Matches the VM's tbd-db: user tbd, database tbd, port 5433.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LOCAL_DB = {
  port: Number(process.env.LOCAL_PG_PORT ?? 5433),
  user: "tbd",
  password: "tbd",
  database: "tbd",
};
export const LOCAL_DATABASE_URL =
  `postgres://${LOCAL_DB.user}:${LOCAL_DB.password}@127.0.0.1:${LOCAL_DB.port}/${LOCAL_DB.database}`;

export async function startLocalPostgres() {
  const databaseDir = join(root, ".pgdata");
  const fresh = !existsSync(join(databaseDir, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: LOCAL_DB.user,
    password: LOCAL_DB.password,
    port: LOCAL_DB.port,
    persistent: true,
    onLog: () => {},
  });
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase(LOCAL_DB.database);
  return { pg, fresh };
}
