/**
 * Turns what the gateway heard into rows: raw_packets, readings, node/gateway health, metrics and
 * alerts. Each packet runs in its own transaction so one bad packet never drops the rest of a batch.
 */
import { config } from "../config.js";
import { withTransaction } from "../db.js";
import { parseGatewayLine, parseNodePacket } from "./packet.js";
import { currentMode, fillPercent, flowRateLph, isOutOfRange, isSuddenDrop, lostBetween, netKg } from "./rules.js";
import { openAlert, resolveAlerts } from "./alerts.js";
import { sendAlertEmail } from "../notify.js";
import { kgToLbs } from "./units.js";

function receivedAt(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function upsertGateway(client, gatewayCode, at) {
  const { rows } = await client.query(
    `insert into gateway (gateway_code, gateway_name, status, last_ping, last_seen)
     values ($1, $1, 'online', $2, $2)
     on conflict (gateway_code) do update
       set status = 'online',
           last_ping = greatest(gateway.last_ping, excluded.last_ping),
           last_seen = greatest(gateway.last_seen, excluded.last_seen)
     returning id`,
    [gatewayCode, at],
  );
  return rows[0].id;
}

/** Finds the node for a LoRa id, creating it and a default bucket the first time it is heard. */
async function ensureNode(client, nodeCode, gatewayId) {
  const created = await client.query(
    `insert into node (gateway_id, node_code, node_name, status)
     values ($1, $2, $2, 'online')
     on conflict (node_code) do nothing
     returning *`,
    [gatewayId, nodeCode],
  );
  if (!created.rows[0]) {
    return (await client.query("select * from node where node_code = $1 for update", [nodeCode])).rows[0];
  }
  await client.query(
    `insert into buckets (node_id, label, tree_species) values ($1, $2, 'Sugar Maple')`,
    [created.rows[0].id, nodeCode],
  );
  return created.rows[0];
}

async function ingestPacket(client, gatewayId, line) {
  const at = receivedAt(line.receivedAt);
  const rawRow = await client.query(
    `insert into raw_packets (gateway_id, received_at, gateway_seq, rssi, snr, crc_ok, raw)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [gatewayId, at, line.gatewaySeq ?? null, line.rssi ?? null, line.snr ?? null, line.crcOk, line.raw ?? ""],
  );
  const packetId = rawRow.rows[0].id;

  let packet;
  try {
    if (line.crcOk === false) throw new Error("CRC failed on the gateway");
    packet = parseNodePacket(line.raw);
  } catch (error) {
    await client.query("update raw_packets set error = $2 where id = $1", [packetId, error.message]);
    return { status: "rejected", error: error.message };
  }

  const node = await ensureNode(client, packet.nodeCode, gatewayId);
  const bucket = (
    await client.query("select * from buckets where node_id = $1 order by id limit 1", [node.id])
  ).rows[0] ?? null;

  const previous = (
    await client.query(
      `select weight_kg, measured_at from readings
        where node_id = $1 and kind <> 'nohx' and weight_kg between -1 and 55
        order by measured_at desc limit 1`,
      [node.id],
    )
  ).rows[0] ?? null;

  const inserted = await client.query(
    `insert into readings (packet_id, node_id, bucket_id, measured_at, kind, seq, weight_kg, raw_counts,
                           uncalibrated, temperature_c)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (node_id, seq, measured_at) do nothing
     returning id`,
    [packetId, node.id, bucket?.id ?? null, at, packet.kind, packet.seq, packet.weightKg, packet.rawCounts,
      packet.uncalibrated, packet.temperatureC],
  );
  await client.query("update raw_packets set parsed_ok = true where id = $1", [packetId]);
  if (!inserted.rows[0]) return { status: "duplicate", node: packet.nodeCode };

  const lost = lostBetween(node.last_seq, packet.seq);
  await client.query(
    `update node set status = 'online', last_seen = greatest(last_seen, $2), last_rssi = $3, last_snr = $4,
            last_seq = coalesce($5, last_seq), packets_received = packets_received + 1,
            packets_lost = packets_lost + $6, hx_ok = $7, calibrated = $8,
            battery_v = coalesce($9, battery_v), gateway_id = coalesce(gateway_id, $10)
      where id = $1`,
    [node.id, at, line.rssi ?? null, line.snr ?? null, packet.seq, lost, packet.hxOk, !packet.uncalibrated,
      packet.batteryV, gatewayId],
  );

  const tag = packet.kind === "test" ? " (test loop)" : "";
  const alertBase = { nodeId: node.id, bucketId: bucket?.id ?? null };
  await resolveAlerts(client, [`offline:node:${node.id}`]);

  if (packet.kind === "nohx") {
    await openAlert(client, {
      ...alertBase, key: `sensor:node:${node.id}`, type: "sensor_missing", severity: "warning",
      message: `${node.node_code} is sending, but its load cell amplifier (HX711) is not detected`,
    });
    return { status: "stored", node: packet.nodeCode, kind: packet.kind };
  }
  await resolveAlerts(client, [`sensor:node:${node.id}`]);

  if (isOutOfRange(packet.weightKg)) {
    await openAlert(client, {
      ...alertBase, key: `range:node:${node.id}`, type: "out_of_range", severity: "warning",
      message: `${node.node_code} read ${packet.weightKg} kg, outside -1 to 55 kg. Check wiring or calibration${tag}`,
    });
    return { status: "stored", node: packet.nodeCode, kind: packet.kind, flags: ["out_of_range"] };
  }
  await resolveAlerts(client, [`range:node:${node.id}`]);

  const events = [];
  const notify = [];
  if (bucket) {
    const mode = currentMode(bucket, at);
    const factor = Number(bucket.calibration_factor ?? 1);
    const fill = fillPercent(packet.weightKg, bucket.tare_kg, bucket.capacity_liters, factor);
    const label = bucket.label ?? node.node_code;
    if (mode === "maintenance") {
      // Someone is working on the station: weight changes count for nothing and raise no alerts.
      events.push("maintenance");
    } else if (fill >= config.fullPercent) {
      await openAlert(client, {
        ...alertBase, key: `full:bucket:${bucket.id}`, type: "bucket_full", severity: "critical",
        message: `${bucket.label ?? node.node_code} is ${fill}% full and ready to empty${tag}`,
      });
    } else if (fill < 50) {
      await resolveAlerts(client, [`full:bucket:${bucket.id}`]);
    }

    const previousNet = netKg(previous?.weight_kg, bucket);
    const currentNet = netKg(packet.weightKg, bucket);
    if (mode !== "maintenance" && isSuddenDrop(previousNet, currentNet)) {
      const droppedKg = previousNet - currentNet;
      if (mode === "collection") {
        // Emptying the bucket on purpose: log it as a collection, no alert.
        events.push("collected");
        await client.query(
          `insert into collection_logs (node_id, bucket_id, volume_collected_liters, weight_kg, collected_at, source)
           values ($1, $2, $3, $4, $5, 'auto')`,
          [node.id, bucket.id, droppedKg, droppedKg, at],
        );
        await resolveAlerts(client, [`full:bucket:${bucket.id}`]);
      } else {
        // A sudden drop nobody announced: the bucket probably tipped over.
        events.push("tipped");
        const alert = await openAlert(client, {
          ...alertBase, key: `tipped:bucket:${bucket.id}:${at.getTime()}`, type: "bucket_tipped", severity: "critical",
          message: `${label} may have tipped over: it lost ${kgToLbs(droppedKg).toFixed(1)} lbs at once${tag}`,
        });
        if (alert) notify.push({ ...alert, station: label, lostLbs: kgToLbs(droppedKg), nowLbs: kgToLbs(Math.max(currentNet, 0)) });
        await resolveAlerts(client, [`full:bucket:${bucket.id}`]);
      }
    }

    await maybeWriteMetric(client, node.id, bucket, packet.weightKg, at);
  }

  return { status: "stored", node: packet.nodeCode, kind: packet.kind, events, notify };
}

/** Keeps the baseline metrics table (fill %, flow rate) at one row per bucket per interval. */
async function maybeWriteMetric(client, nodeId, bucket, weightKg, at) {
  const last = (
    await client.query(
      "select recorded_at from metrics where bucket_id = $1 order by recorded_at desc limit 1",
      [bucket.id],
    )
  ).rows[0];
  if (last && at - new Date(last.recorded_at) < config.metricIntervalMinutes * 60_000) return;

  const hourAgo = (
    await client.query(
      `select weight_kg, measured_at from readings
        where bucket_id = $1 and kind <> 'nohx' and measured_at <= $2::timestamptz - interval '1 hour'
        order by measured_at desc limit 1`,
      [bucket.id, at],
    )
  ).rows[0];
  const flow = hourAgo ? flowRateLph(netKg(hourAgo.weight_kg, bucket), hourAgo.measured_at, netKg(weightKg, bucket), at) : 0;
  await client.query(
    `insert into metrics (node_id, bucket_id, fill_level_percent, sap_flow_rate_lph, recorded_at)
     values ($1, $2, least($3::numeric, 999), $4, $5)`,
    [nodeId, bucket.id, fillPercent(weightKg, bucket.tare_kg, bucket.capacity_liters, Number(bucket.calibration_factor ?? 1)), flow, at],
  );
}

/**
 * body: { gateway: "GW-PC-01", lines: [gateway line objects or JSON strings] }
 *   or  { gateway: "...", packet: { "id": "LC01", ... } } for a single node packet.
 */
export async function ingestBatch(body) {
  const gatewayCode = String(body?.gateway ?? body?.gateway_code ?? "GW-UNKNOWN").slice(0, 50);
  const lines = Array.isArray(body?.lines) ? body.lines : body?.packet ? [body.packet] : [];
  const summary = { gateway: gatewayCode, received: lines.length, stored: 0, duplicate: 0, rejected: 0, status: 0, results: [] };

  for (const rawLine of lines) {
    let line;
    try {
      line = parseGatewayLine(rawLine);
    } catch (error) {
      summary.rejected += 1;
      summary.results.push({ status: "rejected", error: error.message });
      continue;
    }

    const result = await withTransaction(async (client) => {
      const gatewayId = await upsertGateway(client, gatewayCode, receivedAt(line.receivedAt));
      if (line.type !== "packet") {
        return { status: "status", type: line.type };
      }
      await client.query("update gateway set packets_heard = packets_heard + 1 where id = $1", [gatewayId]);
      return ingestPacket(client, gatewayId, line);
    });

    if (result.status === "status") summary.status += 1;
    else summary[result.status] += 1;
    const { notify = [], ...rest } = result;
    summary.results.push(rest);
    // After the commit, so an email never goes out for an alert that was rolled back.
    for (const alert of notify) summary.emailed = (await sendAlertEmail(alert)) || summary.emailed;
  }
  return summary;
}

/** Marks nodes offline when they stop reporting. Runs on a timer in server.js. */
export async function sweepOffline(pool) {
  const { rows } = await pool.query(
    `update node set status = 'offline'
      where status <> 'offline' and last_seen is not null
        and last_seen < now() - make_interval(mins => $1)
      returning id, node_code`,
    [config.offlineAfterMinutes],
  );
  for (const node of rows) {
    await openAlert(pool, {
      nodeId: node.id, bucketId: null, key: `offline:node:${node.id}`, type: "station_offline", severity: "critical",
      message: `${node.node_code} has not reported for ${config.offlineAfterMinutes} minutes`,
    });
  }
  await pool.query(
    `update gateway set status = 'offline'
      where status <> 'offline' and last_seen < now() - make_interval(mins => $1)`,
    [config.offlineAfterMinutes],
  );
  return rows.length;
}
