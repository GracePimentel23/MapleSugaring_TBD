/**
 * HTTP API. Routes are mounted at the root (/stations, /ingest, ...); the Next app exposes them to the
 * browser under /api/*, the same way 7BS's nginx does.
 *
 * Every route after identify() names the permission it needs with can("area:action"); who holds which
 * permission is in rbac.config.js. A test fails if a route is added without one.
 */
import express from "express";
import { actorName, audit, describeChanges } from "./audit.js";
import { authRouter, identify } from "./auth.js";
import { config } from "./config.js";
import { pool, withTransaction } from "./db.js";
import { ingestBatch, sweepOffline } from "./domain/ingest.js";
import { resolveAlerts } from "./domain/alerts.js";
import { MODES, netKg } from "./domain/rules.js";
import { kgToLbs, lbsToKg } from "./domain/units.js";
import { demoRouter } from "./demo.js";
import { checkIngestKey, gatewayKeysRouter } from "./gatewayKeys.js";
import { HttpError, idParam, optionalDate, optionalNumber, optionalText, wrap } from "./http.js";
import { requirePermission as can } from "./rbac.js";
import { usersRouter } from "./users.js";
import {
  getAlerts, getBatches, getCollections, getDashboard, getLiveVersion, getNotes, getSeasons, getStations,
} from "./views.js";

const bucketLabel = (name, id) => name ?? `Bucket #${String(id).padStart(2, "0")}`;

/** Map position, if given: both or neither. */
function optionalPosition(body) {
  const lat = optionalNumber(body?.lat, "lat", { min: -90, max: 90 });
  const lon = optionalNumber(body?.lon, "lon", { min: -180, max: 180 });
  if ((lat === null) !== (lon === null)) throw new HttpError(400, "send lat and lon together");
  return { lat, lon };
}

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
  app.use(demoRouter());

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
    const { lat, lon } = optionalPosition(req.body);
    const bucketId = await withTransaction(async (client) => {
      const node = await client.query(
        `insert into node (node_code, node_name, status) values ($1, $2, 'online')
         on conflict (node_code) do update set node_name = coalesce(node.node_name, excluded.node_name)
         returning id`,
        [nodeCode, name],
      );
      const bucket = await client.query(
        `insert into buckets (node_id, label, location, tree_species, capacity_liters, lat, lon)
         values ($1, $2, $3, $4, coalesce($5, 11.36), $6, $7) returning id`,
        [node.rows[0].id, name, optionalText(req.body?.location, "location", 100),
          optionalText(req.body?.treeSpecies, "treeSpecies", 50) ?? "Sugar Maple",
          capacityLbs === null ? null : lbsToKg(capacityLbs), lat, lon],
      );
      await audit(client, req, {
        entity: "bucket", entityId: bucket.rows[0].id, action: "Added station", record: name, change: `Sensor ${nodeCode}`,
      });
      return bucket.rows[0].id;
    });
    res.status(201).json({ bucketId });
  }));

  app.patch("/stations/:bucketId", can("stations:manage"), wrap(async (req, res) => {
    const bucketId = idParam(req.params.bucketId);
    const capacityLbs = optionalNumber(req.body?.capacityLbs, "capacityLbs", { min: 0.5, max: 200 });
    const tareKg = optionalNumber(req.body?.tareKg, "tareKg", { min: -5, max: 50 });
    const { lat, lon } = optionalPosition(req.body);
    const retired = typeof req.body?.retired === "boolean" ? req.body.retired : null;
    const changes = {
      name: optionalText(req.body?.name, "name", 100),
      location: optionalText(req.body?.location, "location", 100),
      treeSpecies: optionalText(req.body?.treeSpecies, "treeSpecies", 50),
    };
    await withTransaction(async (client) => {
      const before = (await client.query("select * from buckets where id = $1 for update", [bucketId])).rows[0];
      if (!before) throw new HttpError(404, "no such station");
      await client.query(
        `update buckets set label = coalesce($2, label), location = coalesce($3, location),
                tree_species = coalesce($4, tree_species), capacity_liters = coalesce($5, capacity_liters),
                tare_kg = coalesce($6, tare_kg), lat = coalesce($7, lat), lon = coalesce($8, lon),
                retired = coalesce($9, retired)
          where id = $1`,
        [bucketId, changes.name, changes.location, changes.treeSpecies,
          capacityLbs === null ? null : lbsToKg(capacityLbs), tareKg, lat, lon, retired],
      );
      const change = retired !== null && retired !== before.retired
        ? (retired ? "Hidden, data kept" : "Back in use")
        : describeChanges([
          ["Name", before.label, changes.name],
          ["Location", before.location, changes.location],
          ["Species", before.tree_species, changes.treeSpecies],
          ["Target", kgToLbs(before.capacity_liters), capacityLbs, " lbs"],
        ]) || (lat !== null ? "Moved on the map" : "");
      if (change || tareKg !== null) {
        await audit(client, req, {
          entity: "bucket", entityId: bucketId, action: retired ? "Retired tree" : "Edited station",
          record: bucketLabel(before.label, bucketId), change: change || "Tare set",
        });
      }
    });
    res.json({ ok: true });
  }));

  /**
   * { mode: "normal" | "collection" | "maintenance", minutes?, extendMinutes? }. Maintenance pauses alerts
   * while someone works on the station; collection logs a drop as a collection. Both end by themselves.
   */
  app.post("/stations/:bucketId/mode", can("stations:view"), wrap(async (req, res) => {
    const bucketId = idParam(req.params.bucketId);
    const mode = String(req.body?.mode ?? "");
    if (!MODES.includes(mode)) throw new HttpError(400, `mode must be one of ${MODES.join(", ")}`);
    const needs = mode === "collection" ? "collections:log" : "stations:maintenance";
    if (!req.access.permissions.has(needs)) {
      throw new HttpError(req.access.role === "guest" ? 401 : 403, `this needs ${needs}`);
    }
    const minutes = optionalNumber(req.body?.minutes, "minutes", { min: 1, max: 24 * 60 }) ?? config.modeMinutes;
    const extend = optionalNumber(req.body?.extendMinutes, "extendMinutes", { min: 1, max: 12 * 60 });
    await withTransaction(async (client) => {
      const before = (await client.query("select label, mode, mode_until from buckets where id = $1 for update", [bucketId])).rows[0];
      if (!before) throw new HttpError(404, "no such station");
      if (extend !== null) {
        await client.query(
          `update buckets set mode_until = greatest(coalesce(mode_until, now()), now()) + make_interval(mins => $2::int)
            where id = $1 and mode = 'maintenance'`,
          [bucketId, extend],
        );
      } else {
        await client.query(
          `update buckets set mode = $2::varchar,
                  mode_until = case when $2::varchar = 'normal' then null else now() + make_interval(mins => $3::int) end
            where id = $1`,
          [bucketId, mode, minutes],
        );
      }
      if (mode === "maintenance" || before.mode === "maintenance") {
        await audit(client, req, {
          entity: "bucket", entityId: bucketId, record: bucketLabel(before.label, bucketId),
          action: extend !== null ? "Extended maintenance" : mode === "maintenance" ? "Maintenance mode on" : "Maintenance mode off",
          change: extend !== null ? `+${extend} min` : mode === "maintenance" ? `Switches off after ${minutes} min` : "Alerts resumed",
        });
      }
    });
    res.json({ ok: true, mode });
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

  /** { acknowledged: true | false } takes or gives back an alert; { is_resolved } marks it fixed (default). */
  app.patch("/alerts/:id", can("alerts:resolve"), wrap(async (req, res) => {
    const id = idParam(req.params.id);
    const by = actorName(req);
    let result;
    if (typeof req.body?.acknowledged === "boolean") {
      result = await pool.query(
        `update alerts set acknowledged_at = case when $2 then now() end, acknowledged_by = case when $2 then $3 end
          where id = $1`,
        [id, req.body.acknowledged, by],
      );
    } else {
      const resolved = req.body?.is_resolved !== false;
      result = await pool.query(
        `update alerts set is_resolved = $2, resolved_at = case when $2 then now() end,
                resolved_by = case when $2 then $3 end
          where id = $1`,
        [id, resolved, by],
      );
    }
    if (!result.rowCount) throw new HttpError(404, "no such alert");
    res.json({ ok: true });
  }));

  // ---- notes ----------------------------------------------------------------------------------
  app.get("/notes", can("stations:view"), wrap(async (_req, res) => res.json(await getNotes())));

  /** { subject: "bucket" | "batch", subjectId, text }. Members note buckets; batch notes need batches:manage. */
  app.post("/notes", can("collections:log"), wrap(async (req, res) => {
    const subject = String(req.body?.subject ?? "");
    if (!["bucket", "batch"].includes(subject)) throw new HttpError(400, "subject must be bucket or batch");
    if (subject === "batch" && !req.access.permissions.has("batches:manage")) throw new HttpError(403, "this needs batches:manage");
    const subjectId = idParam(req.body?.subjectId, subject === "batch" ? "b" : "");
    const text = optionalText(req.body?.text, "text", 2000);
    if (!text) throw new HttpError(400, "text is required");
    const { rows } = await pool.query(
      "insert into notes (subject, subject_id, text, author) values ($1, $2, $3, $4) returning id",
      [subject, subjectId, text, actorName(req)],
    );
    res.status(201).json({ id: rows[0].id });
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

    const logged = [];
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
            `select b.id, b.node_id, b.tare_kg, b.calibration_factor,
                    (select weight_kg from readings r where r.bucket_id = b.id and r.kind <> 'nohx'
                      order by measured_at desc limit 1) as current_kg
               from buckets b where b.id = $1`,
            [bucketId],
          )
        ).rows[0];
        if (!bucket) throw new HttpError(400, `no bucket ${bucketId}`);
        const lbs = optionalNumber(entry.lbs, "lbs", { min: 0, max: 500 });
        const kg = lbs !== null ? lbsToKg(lbs) : Math.max(netKg(bucket.current_kg ?? 0, bucket), 0);
        await client.query(
          `insert into collection_logs (collection_id, node_id, bucket_id, volume_collected_liters, weight_kg,
                                        collected_by, collected_at, source)
           values ($1, $2, $3, $4, $4, $5,
                   case when $6::date is null or $6::date = current_date then now()
                        else ($6::date + time '12:00')::timestamptz end, 'manual')`,
          [collectionId, bucket.node_id, bucketId, kg, optionalText(entry.collectedBy, "collectedBy", 100) ?? loggedBy, date],
        );
        await resolveAlerts(client, [`full:bucket:${bucketId}`]);
        logged.push({ name: bucketLabel(bucket.label, bucketId), lbs: kgToLbs(kg) });
      }
      await audit(client, req, {
        entity: "collection", entityId: collectionId, action: "Logged collection",
        record: logged.map((entry) => entry.name).join(", "),
        change: `${Math.round(logged.reduce((sum, entry) => sum + entry.lbs, 0) * 10) / 10} lbs`,
      });
      return collectionId;
    });
    res.status(201).json({ id: `c${id}` });
  }));

  /** { date?, batchId? (null unassigns), loggedBy?, notes?, entries?: [{ bucketId, lbs, collectedBy }] } */
  app.patch("/collections/:id", can("collections:edit"), wrap(async (req, res) => {
    const id = idParam(req.params.id, "c");
    const body = req.body ?? {};
    const date = optionalDate(body.date, "date");
    await withTransaction(async (client) => {
      const before = (await client.query("select * from collections where id = $1 for update", [id])).rows[0];
      if (!before) throw new HttpError(404, "no such collection");
      const batchId = body.batchId === undefined ? before.batch_id : body.batchId ? idParam(body.batchId, "b") : null;
      await client.query(
        `update collections set collected_on = coalesce($2::date, collected_on), batch_id = $3,
                logged_by = coalesce($4, logged_by), notes = case when $6 then $5 else notes end
          where id = $1`,
        [id, date, batchId, optionalText(body.loggedBy, "loggedBy", 100),
          optionalText(body.notes, "notes", 2000), body.notes !== undefined],
      );
      if (Array.isArray(body.entries)) {
        if (!body.entries.length) throw new HttpError(400, "a collection needs at least one bucket; delete it instead");
        const kept = body.entries.map((entry) => idParam(entry.bucketId));
        await client.query("delete from collection_logs where collection_id = $1 and not (bucket_id = any($2))", [id, kept]);
        for (const entry of body.entries) {
          const bucketId = idParam(entry.bucketId);
          const lbs = optionalNumber(entry.lbs, "lbs", { min: 0, max: 500 });
          if (lbs === null) throw new HttpError(400, "every bucket needs a weight");
          const collectedBy = optionalText(entry.collectedBy, "collectedBy", 100);
          const updated = await client.query(
            `update collection_logs set weight_kg = $3, volume_collected_liters = $3, collected_by = coalesce($4, collected_by)
              where collection_id = $1 and bucket_id = $2`,
            [id, bucketId, lbsToKg(lbs), collectedBy],
          );
          if (!updated.rowCount) {
            const inserted = await client.query(
              `insert into collection_logs (collection_id, node_id, bucket_id, volume_collected_liters, weight_kg,
                                            collected_by, collected_at, source)
               select $1, b.node_id, b.id, $3, $3, $4, (c.collected_on + time '12:00')::timestamptz, 'manual'
                 from buckets b, collections c where b.id = $2 and c.id = $1`,
              [id, bucketId, lbsToKg(lbs), collectedBy ?? before.logged_by],
            );
            if (!inserted.rowCount) throw new HttpError(400, `no bucket ${bucketId}`);
          }
        }
      }
      if (date) {
        await client.query(
          "update collection_logs set collected_at = ($2::date + time '12:00')::timestamptz where collection_id = $1",
          [id, date],
        );
      }
      await audit(client, req, {
        entity: "collection", entityId: id, action: "Edited collection", record: `Collection ${id}`,
        change: describeChanges([["Date", before.collected_on, date]]) || "Details updated",
      });
    });
    res.json({ ok: true });
  }));

  app.delete("/collections/:id", can("collections:edit"), wrap(async (req, res) => {
    const id = idParam(req.params.id, "c");
    await withTransaction(async (client) => {
      const { rowCount } = await client.query("delete from collections where id = $1", [id]);
      if (!rowCount) throw new HttpError(404, "no such collection");
      await audit(client, req, { entity: "collection", entityId: id, action: "Deleted collection", record: `Collection ${id}` });
    });
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
    const boilMinutes = optionalNumber(body.boilMinutes, "boilMinutes", { min: 0, max: 48 * 60 });
    const row = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into batches (batch_number, started_on, status, sap_in_kg, syrup_out_kg, brix, created_by, notes, boil_minutes)
         values (coalesce($1, 'Batch #' || lpad(((select count(*) from batches) + 1)::text, 2, '0')),
                 coalesce($2::date, current_date), $3, $4, $5, $6, $7, $8, $9)
         returning id, batch_number`,
        [optionalText(body.batchNumber, "batchNumber", 50), optionalDate(body.date, "date"), status,
          sapInLbs === null ? null : lbsToKg(sapInLbs), lbsToKg(syrupOutLbs), brix,
          optionalText(body.createdBy, "createdBy", 100) ?? actorName(req), optionalText(body.notes, "notes", 2000),
          boilMinutes],
      );
      await audit(client, req, { entity: "batch", entityId: rows[0].id, action: "Started batch", record: rows[0].batch_number });
      return rows[0];
    });
    res.status(201).json({ id: `b${row.id}` });
  }));

  app.patch("/batches/:id", can("batches:manage"), wrap(async (req, res) => {
    const body = req.body ?? {};
    const status = body.status ?? null;
    if (status && !["completed", "processing", "active", "waiting"].includes(status)) throw new HttpError(400, "bad status");
    const sapInLbs = optionalNumber(body.sapInLbs, "sapInLbs", { min: 0, max: 100_000 });
    const syrupOutLbs = optionalNumber(body.syrupOutLbs, "syrupOutLbs", { min: 0, max: 10_000 });
    const brix = optionalNumber(body.brix, "brix", { min: 0, max: 80 });
    const boilMinutes = optionalNumber(body.boilMinutes, "boilMinutes", { min: 0, max: 48 * 60 });
    const date = optionalDate(body.date, "date");
    const id = idParam(req.params.id, "b");
    await withTransaction(async (client) => {
      const before = (await client.query("select * from batches where id = $1 for update", [id])).rows[0];
      if (!before) throw new HttpError(404, "no such batch");
      const closed = before.status === "completed";
      if (closed && !req.access.permissions.has("batches:editClosed")) {
        throw new HttpError(403, "this batch is closed; only an owner can override the lock");
      }
      await client.query(
        `update batches set status = coalesce($2, status), sap_in_kg = coalesce($3, sap_in_kg),
                syrup_out_kg = coalesce($4, syrup_out_kg), brix = coalesce($5, brix), notes = coalesce($6, notes),
                started_on = coalesce($7::date, started_on), boil_minutes = coalesce($8, boil_minutes)
          where id = $1`,
        [id, status, sapInLbs === null ? null : lbsToKg(sapInLbs), syrupOutLbs === null ? null : lbsToKg(syrupOutLbs),
          brix, optionalText(body.notes, "notes", 2000), date, boilMinutes],
      );
      await audit(client, req, {
        entity: "batch", entityId: id, record: before.batch_number,
        action: closed ? "Overrode closed batch" : status === "completed" ? "Closed batch" : "Edited batch",
        change: describeChanges([
          ["Status", before.status, status],
          ["Sap in", before.sap_in_kg === null ? null : kgToLbs(before.sap_in_kg), sapInLbs, " lbs"],
          ["Syrup out", kgToLbs(before.syrup_out_kg), syrupOutLbs, " lbs"],
          ["Brix", Number(before.brix), brix, "°"],
        ]) || "Details updated",
      });
    });
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
    res.status(status).json(status >= 500 ? { error: "internal error" } : { ...error.details, error: error.message });
  });

  return app;
}

// Vercel's Express support runs the default export of src/app.js as one function (no listen()).
export default createApp();
