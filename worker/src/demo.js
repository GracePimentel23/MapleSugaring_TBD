/**
 * The Demo tab (temporary, for the sponsor video): tare, station modes, reset history, clear alerts,
 * a test email, and an optional calibration with known weights (gym plates). Open to guests on
 * purpose (permission "demo:use" in rbac.config.js); take that out of GUEST to lock it down.
 */
import { Router } from "express";
import { config } from "./config.js";
import { pool, withTransaction } from "./db.js";
import { calibrationFactor, currentMode, MODES, netKg } from "./domain/rules.js";
import { kgToLbs, lbsToKg } from "./domain/units.js";
import { HttpError, idParam, optionalNumber, wrap } from "./http.js";
import { emailConfigured, lastEmailError, sendEmail } from "./notify.js";
import { requirePermission } from "./rbac.js";

/** Readings this recent count as "on the scale now"; the node sends one every 5 s. */
const RECENT_SECONDS = 30;
/** The last few readings must agree this closely before a tare or calibration point is taken. */
const SETTLED_KG = 0.05;

async function loadBucket(db, bucketId) {
  const bucket = (await db.query("select * from buckets where id = $1", [bucketId])).rows[0];
  if (!bucket) throw new HttpError(404, "no such station");
  return bucket;
}

/** The last 3 recent readings of the bucket's node: their average, and whether they agree. */
async function scaleNow(db, bucket) {
  const { rows } = await db.query(
    `select weight_kg from readings
      where node_id = $1 and kind <> 'nohx' and weight_kg between -1 and 55
        and measured_at > now() - make_interval(secs => $2)
      order by measured_at desc limit 3`,
    [bucket.node_id, RECENT_SECONDS],
  );
  if (!rows.length) return null;
  const weights = rows.map((row) => row.weight_kg);
  return {
    rawKg: weights.reduce((sum, value) => sum + value, 0) / weights.length,
    settled: weights.length === 3 && Math.max(...weights) - Math.min(...weights) <= SETTLED_KG,
  };
}

async function settledScale(db, bucket) {
  const now = await scaleNow(db, bucket);
  if (!now) throw new HttpError(409, "no reading from the scale in the last 30 seconds: is the bridge running?");
  if (!now.settled) throw new HttpError(409, "the scale is still settling; wait a few seconds and try again");
  return now;
}

function bucketIdOf(req) {
  return idParam(req.body?.bucketId ?? req.query.bucket);
}

function maskEmail(address) {
  const [name, domain] = address.split("@");
  return domain ? `${name.slice(0, 2)}***@${domain}` : "***";
}

async function demoState(bucketId) {
  const { rows: stations } = await pool.query(
    `select b.id as bucket_id, coalesce(b.label, n.node_code, 'Bucket #' || b.id) as name, n.last_seen
       from buckets b left join node n on n.id = b.node_id
      where b.node_id is not null order by b.id`,
  );
  // Default to the station heard from most recently (the one on the bench).
  const newest = [...stations].sort((a, b) => new Date(b.last_seen ?? 0) - new Date(a.last_seen ?? 0))[0];
  const chosenId = bucketId ?? newest?.bucket_id;
  if (!chosenId) return { stations: [], station: null };
  const bucket = await loadBucket(pool, chosenId);
  const node = (await pool.query("select node_code, status, last_seen, last_rssi from node where id = $1", [bucket.node_id])).rows[0];

  const [recent, alerts, points, scale] = await Promise.all([
    pool.query(
      `select weight_kg, measured_at from readings
        where node_id = $1 and kind <> 'nohx' and weight_kg between -1 and 55
        order by measured_at desc limit 24`,
      [bucket.node_id],
    ),
    pool.query(
      `select id, alert_type, severity, message, created_at from alerts
        where not is_resolved and (bucket_id = $1 or node_id = $2) order by created_at desc limit 20`,
      [bucket.id, bucket.node_id],
    ),
    pool.query("select id, known_kg, measured_kg, created_at from calibration_points where bucket_id = $1 order by id", [bucket.id]),
    scaleNow(pool, bucket),
  ]);

  const latest = recent.rows[0] ?? null;
  const mode = currentMode(bucket);
  const factor = Number(bucket.calibration_factor);
  const pointList = points.rows.map((row) => ({
    id: row.id,
    knownLbs: kgToLbs(row.known_kg, 1),
    measuredLbs: kgToLbs(row.measured_kg, 2),
    // What the scale would read for this weight with the current calibration, and the error.
    readsLbs: kgToLbs(row.measured_kg * factor, 2),
    errorLbs: kgToLbs(row.measured_kg * factor - row.known_kg, 2),
  }));
  const suggested = calibrationFactor(points.rows.map((row) => ({ knownKg: row.known_kg, measuredKg: row.measured_kg })));

  return {
    stations: stations.map((row) => ({ bucketId: row.bucket_id, name: row.name })),
    station: {
      bucketId: bucket.id,
      name: bucket.label ?? node?.node_code ?? `Bucket #${bucket.id}`,
      nodeCode: node?.node_code ?? null,
      online: node?.status !== "offline",
      lastSeen: node?.last_seen ? new Date(node.last_seen).toISOString() : null,
      rssi: node?.last_rssi ?? null,
      mode,
      modeUntil: mode === "normal" ? null : new Date(bucket.mode_until).toISOString(),
      tareLbs: kgToLbs(Number(bucket.tare_kg), 2),
      calibrationFactor: factor,
      capacityLbs: kgToLbs(Number(bucket.capacity_liters ?? 11.36)),
      weightLbs: latest ? kgToLbs(Math.max(netKg(latest.weight_kg, bucket), 0), 2) : null,
      // Signed, so a scale that drifts below its tare shows it.
      exactWeightLbs: latest ? kgToLbs(netKg(latest.weight_kg, bucket), 2) : null,
      measuredAt: latest ? new Date(latest.measured_at).toISOString() : null,
      settled: scale?.settled ?? false,
      recent: recent.rows.reverse().map((row) => ({
        at: new Date(row.measured_at).toISOString(),
        lbs: kgToLbs(Math.max(netKg(row.weight_kg, bucket), 0), 2),
      })),
    },
    alerts: alerts.rows.map((row) => ({ ...row, created_at: new Date(row.created_at).toISOString() })),
    calibration: {
      points: pointList,
      suggestedFactor: suggested,
    },
    email: { configured: emailConfigured(), to: config.email.to.map(maskEmail) },
    modeMinutes: config.modeMinutes,
  };
}

export function demoRouter() {
  const router = Router();
  const can = requirePermission("demo:use");

  router.get("/demo", can, wrap(async (req, res) => {
    res.json(await demoState(req.query.bucket ? idParam(req.query.bucket) : null));
  }));

  /** Zero the scale in the app: whatever is on it now reads 0 lbs. */
  router.post("/demo/tare", can, wrap(async (req, res) => {
    const bucket = await loadBucket(pool, bucketIdOf(req));
    const { rawKg } = await settledScale(pool, bucket);
    await pool.query("update buckets set tare_kg = $2 where id = $1", [bucket.id, rawKg]);
    res.json({ ok: true, tareLbs: kgToLbs(rawKg, 2) });
  }));

  /** { bucketId, mode }: normal, collection or maintenance (the last two end after MODE_MINUTES). */
  router.post("/demo/mode", can, wrap(async (req, res) => {
    const bucket = await loadBucket(pool, bucketIdOf(req));
    const mode = String(req.body?.mode ?? "");
    if (!MODES.includes(mode)) throw new HttpError(400, `mode must be one of ${MODES.join(", ")}`);
    await pool.query(
      `update buckets set mode = $2::varchar,
              mode_until = case when $2::varchar = 'normal' then null else now() + make_interval(mins => $3::int) end
        where id = $1`,
      [bucket.id, mode, config.modeMinutes],
    );
    res.json({ ok: true, mode });
  }));

  /** Forget the station's readings, alerts, auto collections and metrics. Tare and calibration stay. */
  router.post("/demo/reset", can, wrap(async (req, res) => {
    const bucket = await loadBucket(pool, bucketIdOf(req));
    const deleted = await withTransaction(async (client) => {
      const readings = await client.query(
        `with gone as (delete from readings where node_id = $1 returning packet_id)
         delete from raw_packets where id in (select packet_id from gone where packet_id is not null)`,
        [bucket.node_id],
      );
      await client.query("delete from readings where node_id = $1", [bucket.node_id]);
      await client.query("delete from alerts where bucket_id = $1 or node_id = $2", [bucket.id, bucket.node_id]);
      await client.query("delete from metrics where bucket_id = $1 or node_id = $2", [bucket.id, bucket.node_id]);
      await client.query("delete from collection_logs where bucket_id = $1 or node_id = $2", [bucket.id, bucket.node_id]);
      await client.query(
        "delete from collections c where not exists (select 1 from collection_logs l where l.collection_id = c.id)",
      );
      await client.query(
        "update node set packets_received = 0, packets_lost = 0, last_seq = null where id = $1",
        [bucket.node_id],
      );
      return readings.rowCount;
    });
    res.json({ ok: true, packetsDeleted: deleted });
  }));

  /** Resolve every open alert, on every station. */
  router.post("/demo/clear-alerts", can, wrap(async (_req, res) => {
    const { rowCount } = await pool.query(
      "update alerts set is_resolved = true, resolved_at = now() where is_resolved = false",
    );
    res.json({ ok: true, cleared: rowCount });
  }));

  router.post("/demo/test-email", can, wrap(async (_req, res) => {
    if (!emailConfigured()) throw new HttpError(409, "email is not set up: RESEND_API_KEY and ALERT_EMAIL_TO on the API");
    const sent = await sendEmail({
      subject: "Maple Sugaring: test alert email",
      text: "This is a test from the Demo tab. Bucket tipped alerts will arrive like this.",
    });
    // 409, not 5xx: the error handler hides 5xx messages, and this one tells you what to fix.
    if (!sent) throw new HttpError(409, `the email service refused it: ${lastEmailError() ?? "see the API logs"}`);
    res.json({ ok: true });
  }));

  /** { bucketId, knownLbs }: the known weight (e.g. a 25 lb plate) sitting on the scale right now. */
  router.post("/demo/calibration/points", can, wrap(async (req, res) => {
    const bucket = await loadBucket(pool, bucketIdOf(req));
    const knownLbs = optionalNumber(req.body?.knownLbs, "knownLbs", { min: 1, max: 110 });
    if (knownLbs === null) throw new HttpError(400, "knownLbs is required");
    const { rawKg } = await settledScale(pool, bucket);
    const measuredKg = rawKg - Number(bucket.tare_kg);
    if (measuredKg < 0.2) throw new HttpError(409, "the scale reads about 0: put the weight on (and tare it empty first)");
    await pool.query(
      "insert into calibration_points (bucket_id, known_kg, measured_kg) values ($1, $2, $3)",
      [bucket.id, lbsToKg(knownLbs), measuredKg],
    );
    res.status(201).json({ ok: true });
  }));

  /** Use the points taken so far to set the calibration factor. */
  router.post("/demo/calibration/apply", can, wrap(async (req, res) => {
    const bucket = await loadBucket(pool, bucketIdOf(req));
    const { rows } = await pool.query("select known_kg, measured_kg from calibration_points where bucket_id = $1", [bucket.id]);
    const factor = calibrationFactor(rows.map((row) => ({ knownKg: row.known_kg, measuredKg: row.measured_kg })));
    if (factor === null) throw new HttpError(409, "those points disagree too much (more than 2x); clear them and try again");
    await pool.query("update buckets set calibration_factor = $2 where id = $1", [bucket.id, factor]);
    res.json({ ok: true, factor });
  }));

  /** Back to the node's own calibration (factor 1) and no points. */
  router.post("/demo/calibration/reset", can, wrap(async (req, res) => {
    const bucket = await loadBucket(pool, bucketIdOf(req));
    await withTransaction(async (client) => {
      await client.query("delete from calibration_points where bucket_id = $1", [bucket.id]);
      await client.query("update buckets set calibration_factor = 1 where id = $1", [bucket.id]);
    });
    res.json({ ok: true });
  }));

  return router;
}
