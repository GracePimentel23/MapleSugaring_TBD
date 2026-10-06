/**
 * HTTP API. Routes are mounted at the root (/stations, /ingest, ...); the Next app exposes them to the
 * browser under /api/*, the same way 7BS's nginx does.
 *
 * Every route after identify() names the permission it needs with can("area:action"); who holds which
 * permission is in rbac.config.js. A test fails if a route is added without one.
 */
import express from "express";
import { authRouter, identify } from "./auth.js";
import { config } from "./config.js";
import { pool, withTransaction } from "./db.js";
import { ingestBatch, sweepOffline } from "./domain/ingest.js";
import { resolveAlerts } from "./domain/alerts.js";
import { lbsToKg } from "./domain/units.js";
import { checkIngestKey, gatewayKeysRouter } from "./gatewayKeys.js";
import { HttpError, idParam, optionalDate, optionalNumber, optionalText, wrap } from "./http.js";
import { requirePermission as can } from "./rbac.js";
import { usersRouter } from "./users.js";
import { getAlerts, getBatches, getCollections, getDashboard, getLiveVersion, getSeasons, getStations } from "./views.js";

/**
 * Marks silent nodes offline before a read. server.js also does this on a timer, but on Vercel there
 * is no long-lived process, so reads do it, at most every 30 s per instance.
 */
let lastSweep = 0;
const sweepBeforeRead = wrap(async (_req, _res, next) => {
  if (Date.now() - lastSweep > 30_000) {
    lastSweep = Date.now();
    await sweepOffline(pool).catch((error) => console.error("offline sweep failed", error.message));
  }
  next();
});

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", wrap(async (_req, res) => {
    try {
      await pool.query("select 1");
      res.json({ ok: true, db: "up" });
    } catch (error) {
      res.status(503).json({ ok: false, db: "down", error: error.message });
    }
  }));

  // ---- ingest (gateway bridge) ----------------------------------------------------------------
  app.post("/ingest", wrap(async (req, res) => {
    const { gatewayCode } = await checkIngestKey(req);
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : req.body?.packet ? [req.body.packet] : null;
    if (!lines) throw new HttpError(400, 'send {"gateway": "...", "lines": [...]} or {"gateway": "...", "packet": {...}}');
    if (lines.length > 500) throw new HttpError(413, "at most 500 lines per request");
    res.json(await ingestBatch(gatewayCode ? { ...req.body, gateway: gatewayCode } : req.body));
  }));

  // ---- sign-in and people (everything below checks the caller's permissions) ---------------------
  app.use(identify());
  app.use(authRouter());
  app.use(usersRouter());
  app.use(gatewayKeysRouter());

  // ---- live updates -----------------------------------------------------------------------------
  /** A short string that changes whenever a reading, alert, collection or node status changes. */
  app.get("/live", can("stations:view"), sweepBeforeRead, wrap(async (_req, res) => {
    res.json({ version: await getLiveVersion() });
  }));

  // ---- stations ---------------------------------------------------------------------------------
  app.get("/stations", can("stations:view"), sweepBeforeRead, wrap(async (_req, res) => res.json(await getStations())));

  app.get("/stations/:bucketId", can("stations:view"), wrap(async (req, res) => {
    const bucketId = idParam(req.params.bucketId);
    const { stations, alerts } = await getStations();
    const station = stations.find((item) => item.bucketId === bucketId);
    if (!station) throw new HttpError(404, "no such station");
    res.json({
      station,
      alerts: alerts.filter((alert) => alert.bucket_id === bucketId || alert.node_id === station.nodeId),
    });
  }));

  app.post("/stations", can("stations:manage"), wrap(async (req, res) => {
    const name = optionalText(req.body?.name, "name", 100);
    if (!name) throw new HttpError(400, "name is required");
    const capacityLbs = optionalNumber(req.body?.capacityLbs, "capacityLbs", { min: 0.5, max: 200 });
    const nodeCode = optionalText(req.body?.nodeCode, "nodeCode", 32) ?? name;
    const bucketId = await withTransaction(async (client) => {
      const node = await client.query(
        `insert into node (node_code, node_name, status) values ($1, $2, 'online')
         on conflict (node_code) do update set node_name = coalesce(node.node_name, excluded.node_name)
         returning id`,
        [nodeCode, name],
      );
      const bucket = await client.query(
        `insert into buckets (node_id, label, location, tree_species, capacity_liters)
         values ($1, $2, $3, $4, coalesce($5, 11.36)) returning id`,
        [node.rows[0].id, name, optionalText(req.body?.location, "location", 100),
          optionalText(req.body?.treeSpecies, "treeSpecies", 50) ?? "Sugar Maple",
          capacityLbs === null ? null : lbsToKg(capacityLbs)],
      );
      return bucket.rows[0].id;
    });
    res.status(201).json({ bucketId });
  }));

  app.patch("/stations/:bucketId", can("stations:manage"), wrap(async (req, res) => {
    const bucketId = idParam(req.params.bucketId);
    const capacityLbs = optionalNumber(req.body?.capacityLbs, "capacityLbs", { min: 0.5, max: 200 });
    const tareKg = optionalNumber(req.body?.tareKg, "tareKg", { min: -5, max: 50 });
    const { rowCount } = await pool.query(
      `update buckets set label = coalesce($2, label), location = coalesce($3, location),
              tree_species = coalesce($4, tree_species), capacity_liters = coalesce($5, capacity_liters),
              tare_kg = coalesce($6, tare_kg)
        where id = $1`,
      [bucketId, optionalText(req.body?.name, "name", 100), optionalText(req.body?.location, "location", 100),
        optionalText(req.body?.treeSpecies, "treeSpecies", 50), capacityLbs === null ? null : lbsToKg(capacityLbs), tareKg],
    );
    if (!rowCount) throw new HttpError(404, "no such station");
    res.json({ ok: true });
  }));

  // ---- raw data -------------------------------------------------------------------------------
  app.get("/readings", can("sensors:view"), wrap(async (req, res) => {
    const limit = Math.min(optionalNumber(req.query.limit, "limit", { min: 1, max: 5000 }) ?? 200, 5000);
    const params = [limit];
    const where = [];
    if (req.query.node) {
      params.push(String(req.query.node));
      where.push(`n.node_code = $${params.length}`);
    }
    if (req.query.bucket) {
      params.push(idParam(req.query.bucket));
      where.push(`r.bucket_id = $${params.length}`);
    }
    if (req.query.since) {
      params.push(new Date(String(req.query.since)));
      where.push(`r.measured_at >= $${params.length}`);
    }
    const { rows } = await pool.query(
      `select r.id, n.node_code, r.bucket_id, r.measured_at, r.kind, r.seq, r.weight_kg, r.raw_counts,
              r.uncalibrated, p.rssi, p.snr
         from readings r join node n on n.id = r.node_id left join raw_packets p on p.id = r.packet_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by r.measured_at desc limit $1`,
      params,
    );
    res.json(rows);
  }));

  app.get("/packets", can("sensors:view"), wrap(async (req, res) => {
    const limit = Math.min(optionalNumber(req.query.limit, "limit", { min: 1, max: 1000 }) ?? 100, 1000);
    const { rows } = await pool.query(
      `select p.*, g.gateway_code from raw_packets p left join gateway g on g.id = p.gateway_id
        order by p.received_at desc limit $1`,
      [limit],
    );
    res.json(rows);
  }));

  app.get("/nodes", can("sensors:view"), wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `select n.*, g.gateway_code from node n left join gateway g on g.id = n.gateway_id order by n.id`,
    );
    res.json(rows);
  }));

  app.get("/gateways", can("sensors:view"), wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `select g.*, (select count(*)::int from raw_packets p
                     where p.gateway_id = g.id and p.received_at > now() - interval '1 hour') as packets_last_hour
         from gateway g order by g.id`,
    );
    res.json(rows);
  }));

  // ---- alerts ---------------------------------------------------------------------------------
  app.get("/alerts", can("alerts:view"), wrap(async (req, res) => {
    res.json(await getAlerts({ openOnly: req.query.all === undefined }));
  }));

  app.patch("/alerts/:id", can("alerts:resolve"), wrap(async (req, res) => {
    const id = idParam(req.params.id);
    const resolved = req.body?.is_resolved !== false;
    const { rowCount } = await pool.query(
      `update alerts set is_resolved = $2, resolved_at = case when $2 then now() end where id = $1`,
      [id, resolved],
    );
    if (!rowCount) throw new HttpError(404, "no such alert");
    res.json({ ok: true });
  }));

  // ---- collections ----------------------------------------------------------------------------
  app.get("/collections", can("collections:view"), wrap(async (_req, res) => res.json(await getCollections())));

  /**
   * { date, bucketIds: [1,2], entries?: [{bucketId, lbs, collectedBy}], batchId?, loggedBy, notes }
   * A bucket without an explicit lbs is logged at its current load cell weight.
   */
  app.post("/collections", can("collections:log"), wrap(async (req, res) => {
    const body = req.body ?? {};
    const entries = Array.isArray(body.entries)
      ? body.entries
      : (Array.isArray(body.bucketIds) ? body.bucketIds : []).map((bucketId) => ({ bucketId }));
    if (!entries.length) throw new HttpError(400, "pick at least one bucket");
    const date = optionalDate(body.date, "date");
    const loggedBy = optionalText(body.loggedBy, "loggedBy", 100);
    const batchId = body.batchId ? idParam(body.batchId, "b") : null;

    const id = await withTransaction(async (client) => {
      const collection = await client.query(
        `insert into collections (collected_on, batch_id, logged_by, notes)
         values (coalesce($1::date, current_date), $2, $3, $4) returning id, collected_on`,
        [date, batchId, loggedBy, optionalText(body.notes, "notes", 2000)],
      );
      const collectionId = collection.rows[0].id;
      for (const entry of entries) {
        const bucketId = idParam(entry.bucketId);
        const bucket = (
          await client.query(
            `select b.id, b.node_id, b.tare_kg,
                    (select weight_kg from readings r where r.bucket_id = b.id and r.kind <> 'nohx'
                      order by measured_at desc limit 1) as current_kg
               from buckets b where b.id = $1`,
            [bucketId],
          )
        ).rows[0];
        if (!bucket) throw new HttpError(400, `no bucket ${bucketId}`);
        const lbs = optionalNumber(entry.lbs, "lbs", { min: 0, max: 500 });
        const kg = lbs !== null ? lbsToKg(lbs) : Math.max((bucket.current_kg ?? 0) - (bucket.tare_kg ?? 0), 0);
        await client.query(
          `insert into collection_logs (collection_id, node_id, bucket_id, volume_collected_liters, weight_kg,
                                        collected_by, collected_at, source)
           values ($1, $2, $3, $4, $4, $5,
                   case when $6::date is null or $6::date = current_date then now()
                        else ($6::date + time '12:00')::timestamptz end, 'manual')`,
          [collectionId, bucket.node_id, bucketId, kg, optionalText(entry.collectedBy, "collectedBy", 100) ?? loggedBy, date],
        );
        await resolveAlerts(client, [`full:bucket:${bucketId}`]);
      }
      return collectionId;
    });
    res.status(201).json({ id: `c${id}` });
  }));

  app.delete("/collections/:id", can("collections:edit"), wrap(async (req, res) => {
    const { rowCount } = await pool.query("delete from collections where id = $1", [idParam(req.params.id, "c")]);
    if (!rowCount) throw new HttpError(404, "no such collection");
    res.json({ ok: true });
  }));

  // ---- batches --------------------------------------------------------------------------------
  app.get("/batches", can("batches:view"), wrap(async (_req, res) => res.json(await getBatches())));

  app.post("/batches", can("batches:manage"), wrap(async (req, res) => {
    const body = req.body ?? {};
    const sapInLbs = optionalNumber(body.sapInLbs, "sapInLbs", { min: 0, max: 100_000 });
    const syrupOutLbs = optionalNumber(body.syrupOutLbs, "syrupOutLbs", { min: 0, max: 10_000 }) ?? 0;
    const brix = optionalNumber(body.brix, "brix", { min: 0, max: 80 }) ?? 0;
    const status = body.status ?? (syrupOutLbs > 0 ? "completed" : "active");
    if (!["completed", "processing", "active", "waiting"].includes(status)) throw new HttpError(400, "bad status");
    const { rows } = await pool.query(
      `insert into batches (batch_number, started_on, status, sap_in_kg, syrup_out_kg, brix, created_by, notes)
       values (coalesce($1, 'Batch #' || lpad(((select count(*) from batches) + 1)::text, 2, '0')),
               coalesce($2::date, current_date), $3, $4, $5, $6, $7, $8)
       returning id`,
      [optionalText(body.batchNumber, "batchNumber", 50), optionalDate(body.date, "date"), status,
        sapInLbs === null ? null : lbsToKg(sapInLbs), lbsToKg(syrupOutLbs), brix,
        optionalText(body.createdBy, "createdBy", 100), optionalText(body.notes, "notes", 2000)],
    );
    res.status(201).json({ id: `b${rows[0].id}` });
  }));

  app.patch("/batches/:id", can("batches:manage"), wrap(async (req, res) => {
    const body = req.body ?? {};
    const status = body.status ?? null;
    if (status && !["completed", "processing", "active", "waiting"].includes(status)) throw new HttpError(400, "bad status");
    const sapInLbs = optionalNumber(body.sapInLbs, "sapInLbs", { min: 0, max: 100_000 });
    const syrupOutLbs = optionalNumber(body.syrupOutLbs, "syrupOutLbs", { min: 0, max: 10_000 });
    const { rowCount } = await pool.query(
      `update batches set status = coalesce($2, status), sap_in_kg = coalesce($3, sap_in_kg),
              syrup_out_kg = coalesce($4, syrup_out_kg), brix = coalesce($5, brix), notes = coalesce($6, notes)
        where id = $1`,
      [idParam(req.params.id, "b"), status, sapInLbs === null ? null : lbsToKg(sapInLbs),
        syrupOutLbs === null ? null : lbsToKg(syrupOutLbs), optionalNumber(body.brix, "brix", { min: 0, max: 80 }),
        optionalText(body.notes, "notes", 2000)],
    );
    if (!rowCount) throw new HttpError(404, "no such batch");
    res.json({ ok: true });
  }));

  // ---- summaries ------------------------------------------------------------------------------
  app.get("/seasons", can("dashboard:view"), wrap(async (_req, res) => res.json(await getSeasons())));
  app.get("/dashboard", can("dashboard:view"), sweepBeforeRead, wrap(async (_req, res) => res.json(await getDashboard())));

  // ---- errors ---------------------------------------------------------------------------------
  app.use((_req, _res, next) => next(new HttpError(404, "not found")));
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    const status = error.status ?? (error.type === "entity.parse.failed" ? 400 : 500);
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status >= 500 ? "internal error" : error.message });
  });

  return app;
}

// Vercel's Express support runs the default export of src/app.js as one function (no listen()).
export default createApp();
