/**
 * Make, list and revoke bridge keys straight in the database (no sign-in needed). Point DATABASE_URL
 * at the database the app uses, e.g. the Neon URL from Vercel, then:
 *   npm run gateway-key -- create GW-LAB
 *   npm run gateway-key -- list
 *   npm run gateway-key -- revoke 3
 */
import { pool } from "../src/db.js";
import { createGatewayKey, listGatewayKeys, revokeGatewayKey } from "../src/gatewayKeys.js";
import { runMigrations } from "../src/migrate.js";

const [command, arg] = process.argv.slice(2);
try {
  await runMigrations(pool, () => {});
  if (command === "create") {
    const created = await createGatewayKey(pool, arg);
    console.log(`key for ${created.gateway_code} (shown once, put it in bridge/bridge.env as INGEST_KEY):`);
    console.log(created.key);
  } else if (command === "list") {
    console.table(await listGatewayKeys(pool));
  } else if (command === "revoke") {
    console.log((await revokeGatewayKey(pool, Number(arg))) ? `revoked key ${arg}` : `no active key ${arg}`);
  } else {
    console.log("usage: npm run gateway-key -- create <gateway name> | list | revoke <id>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
