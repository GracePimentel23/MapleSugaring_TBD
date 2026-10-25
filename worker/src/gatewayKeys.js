/**
 * Ingest keys for the gateway bridge. /ingest accepts either the shared INGEST_KEY or a per-gateway
 * key from gateway_keys (stored hashed). With neither configured, ingest is open, except where
 * config.requireIngestKey says it must not be (always on Vercel).
 *
 *   npm run gateway-key -- create GW-LAB     prints a new key once
 *   npm run gateway-key -- list | revoke <id>
 * or, as an owner, GET/POST/DELETE /gateway-keys.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { config } from "./config.js";
import { pool } from "./db.js";
import { HttpError, idParam, optionalText, wrap } from "./http.js";
import { requirePermission } from "./rbac.js";

const KEY_PREFIX = "tbdgw_";

export function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

function sameText(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function createGatewayKey(db, gatewayCode, createdBy = null) {
  const code = optionalText(gatewayCode, "gateway", 50);
  if (!code) throw new HttpError(400, "gateway name is required, e.g. GW-LAB");
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  const { rows } = await db.query(
    `insert into gateway_keys (gateway_code, key_hash, key_prefix, created_by)
     values ($1, $2, $3, $4) returning id, gateway_code, key_prefix, created_at`,
    [code, hashKey(key), key.slice(0, 12), createdBy],
  );
  return { ...rows[0], key };
}

export async function listGatewayKeys(db) {
  const { rows } = await db.query(
    `select id, gateway_code, key_prefix, created_at, last_used_at, revoked_at from gateway_keys order by id`,
  );
  return rows;
}

export async function revokeGatewayKey(db, id) {
  const { rowCount } = await db.query(
    "update gateway_keys set revoked_at = now() where id = $1 and revoked_at is null",
    [id],
  );
  return rowCount > 0;
}

/**
 * Checks X-Ingest-Key. Returns { gatewayCode } when the key names its gateway, {} when the request
 * may go ahead under the name in its body, and throws 401 otherwise.
 */
export async function checkIngestKey(req) {
  const sent = req.get("x-ingest-key")?.trim() || "";
  if (sent && config.ingestKey && sameText(sent, config.ingestKey)) return {};

  if (sent.startsWith(KEY_PREFIX)) {
    const { rows } = await pool.query(
      `update gateway_keys set last_used_at = now()
        where key_hash = $1 and revoked_at is null returning gateway_code`,
      [hashKey(sent)],
    );
    if (rows[0]) return { gatewayCode: rows[0].gateway_code };
  }

  if (!sent && !config.ingestKey && !config.requireIngestKey) {
    const { rows } = await pool.query("select 1 from gateway_keys where revoked_at is null limit 1");
    if (!rows[0]) return {}; // nothing configured yet: open, for local dev and the simulator
  }
  throw new HttpError(401, sent ? "wrong or revoked X-Ingest-Key" : "missing X-Ingest-Key");
}

export function gatewayKeysRouter() {
  const router = Router();
  const can = requirePermission("gateways:manage");

  router.get("/gateway-keys", can, wrap(async (_req, res) => res.json(await listGatewayKeys(pool))));

  /** { gateway: "GW-LAB" }. The answer holds the key; it is never shown again. */
  router.post("/gateway-keys", can, wrap(async (req, res) => {
    res.status(201).json(await createGatewayKey(pool, req.body?.gateway, req.user?.id ?? null));
  }));

  router.delete("/gateway-keys/:id", can, wrap(async (req, res) => {
    if (!(await revokeGatewayKey(pool, idParam(req.params.id)))) throw new HttpError(404, "no such active key");
    res.json({ ok: true });
  }));

  return router;
}
