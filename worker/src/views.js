/**
 * Read models shaped exactly like the types in web/lib/types/schema.ts, so the Next app can swap its
 * mock data for these responses without reshaping anything.
 */
import { config } from "./config.js";
import { pool } from "./db.js";
import { KG_TO_LBS, cToF, kgToLbs, round } from "./domain/units.js";
import { clockLabel, localDate, sapSeason } from "./domain/time.js";
import { currentMode, netKg } from "./domain/rules.js";

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function weekdayOf(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return SHORT_DAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function monthDay(isoDate) {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${MONTH[month - 1]} ${day}`;
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

// ---------------------------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------------------------

export async function getAlerts({ openOnly = true } = {}) {
  const { rows } = await pool.query(
    `select id, node_id, bucket_id, alert_type, severity, message, is_resolved, created_at, resolved_at
       from alerts ${openOnly ? "where is_resolved = false" : ""}
      order by created_at desc limit 200`,
  );
  return rows.map((row) => ({ ...row, created_at: iso(row.created_at), resolved_at: iso(row.resolved_at) }));
}

export async function getStations() {
  const { rows } = await pool.query(
    `select b.id as bucket_id, b.label, b.location, b.tree_species, b.capacity_liters, b.tare_kg,
            b.calibration_factor, b.mode, b.mode_until,
            n.id as node_id, n.node_code, n.node_name, n.status as node_status, n.battery_level, n.battery_v,
            n.last_seen, n.last_rssi, n.last_snr, n.packets_received, n.packets_lost, n.hx_ok, n.calibrated,
            r.weight_kg, r.measured_at, r.kind as reading_kind,
            m.fill_level_percent, m.sap_flow_rate_lph, m.recorded_at as metric_at,
            (select count(*)::int from alerts a
              where not a.is_resolved and a.severity <> 'info'
                and (a.bucket_id = b.id or a.node_id = n.id)) as open_alerts
       from buckets b
       left join node n on n.id = b.node_id
       left join lateral (
         select weight_kg, measured_at, kind from readings
          where bucket_id = b.id and kind <> 'nohx' and weight_kg between -1 and 55
          order by measured_at desc limit 1) r on true
       left join lateral (
         select fill_level_percent, sap_flow_rate_lph, recorded_at from metrics
          where bucket_id = b.id order by recorded_at desc limit 1) m on true
      order by b.id`,
  );

  const trends = await pool.query(
    `select distinct on (bucket_id, day) bucket_id, day, fill_level_percent
       from (select bucket_id, fill_level_percent, recorded_at,
                    (recorded_at at time zone $1)::date as day
               from metrics where recorded_at > now() - interval '7 days') recent
      order by bucket_id, day, recorded_at desc`,
    [config.timeZone],
  );
  const trendByBucket = new Map();
  for (const row of trends.rows) {
    const list = trendByBucket.get(row.bucket_id) ?? [];
    list.push(row.fill_level_percent);
    trendByBucket.set(row.bucket_id, list);
  }

  const stations = rows.map((row) => {
    const capacityKg = row.capacity_liters ?? 11.36;
    const readingIsNewer =
      row.measured_at && (!row.metric_at || new Date(row.measured_at) >= new Date(row.metric_at));
    const currentKg = readingIsNewer
      ? Math.max(netKg(row.weight_kg, row), 0)
      : ((row.fill_level_percent ?? 0) / 100) * capacityKg;
    const fillPercent = capacityKg ? round((currentKg / capacityKg) * 100, 1) : 0;
    const offline = row.node_status === "offline";
    const updatedAt = readingIsNewer ? row.measured_at : row.metric_at;

    const trendPercents = trendByBucket.get(row.bucket_id) ?? [];
    const trend = trendPercents.map((percent) => kgToLbs((percent / 100) * capacityKg));
    if (readingIsNewer) trend.push(kgToLbs(currentKg));

    return {
      bucketId: row.bucket_id,
      nodeId: row.node_id,
      name: row.label ?? row.node_name ?? row.node_code ?? `Bucket #${row.bucket_id}`,
      treeSpecies: row.tree_species ?? "Sugar Maple",
      status: offline ? "offline" : row.open_alerts > 0 ? "attention" : "online",
      displayStatus: offline ? "offline" : fillPercent >= 100 ? "complete" : "in_progress",
      lastUpdated: clockLabel(updatedAt),
      currentLbs: kgToLbs(currentKg),
      capacityLbs: kgToLbs(capacityKg),
      fillPercent,
      batteryLevel: row.battery_level ?? 0,
      sapFlowLph: row.sap_flow_rate_lph ?? 0,
      trend: trend.slice(-7),
      // Extra fields the current UI does not read yet.
      location: row.location,
      nodeCode: row.node_code,
      lastSeen: iso(row.last_seen),
      updatedAt: iso(updatedAt),
      rssi: row.last_rssi,
      snr: row.last_snr,
      packetsReceived: row.packets_received ?? 0,
      packetsLost: row.packets_lost ?? 0,
      sensorOk: row.hx_ok,
      calibrated: row.calibrated,
      isTestReading: row.reading_kind === "test",
      mode: currentMode(row),
    };
  });

  const alerts = await getAlerts();
  const onlineCount = rows.filter((row) => row.node_id && row.node_status !== "offline").length;
  const alertCount = alerts.filter((alert) => alert.severity !== "info").length;
  return {
    stations,
    alerts,
    onlineCount,
    alertCount,
    summaryLabel: `${onlineCount} online · ${alertCount} alert${alertCount === 1 ? "" : "s"}`,
  };
}

/** See GET /live: cheap to compute (primary-key maxima and two small counts). */
export async function getLiveVersion() {
  const { rows } = await pool.query(
    `select (select coalesce(max(id), 0) from readings) as readings,
            (select coalesce(max(id), 0) from alerts) as alerts,
            (select count(*) from alerts where is_resolved = false) as open_alerts,
            (select coalesce(max(id), 0) from collection_logs) as collections,
            (select count(*) from node where status = 'offline') as offline`,
  );
  const row = rows[0];
  return [row.readings, row.alerts, row.open_alerts, row.collections, row.offline].join(".");
}

// ---------------------------------------------------------------------------------------------
// Collections and batches
// ---------------------------------------------------------------------------------------------

export async function getCollections() {
  const { rows } = await pool.query(
    `select c.id, c.collected_on, c.logged_by, c.notes, bt.batch_number,
            row_number() over (order by c.collected_on, c.id) as collection_number,
            coalesce(json_agg(json_build_object(
              'bucketId', l.bucket_id,
              'bucketName', coalesce(b.label, n.node_name, n.node_code, 'Bucket #' || l.bucket_id),
              'collectedBy', coalesce(l.collected_by, c.logged_by, ''),
              'kg', coalesce(l.weight_kg, l.volume_collected_liters)
            ) order by l.bucket_id) filter (where l.id is not null), '[]') as entries
       from collections c
       left join batches bt on bt.id = c.batch_id
       left join collection_logs l on l.collection_id = c.id
       left join buckets b on b.id = l.bucket_id
       left join node n on n.id = b.node_id
      group by c.id, bt.batch_number
      order by c.collected_on desc, c.id desc`,
  );
  return rows.map((row) => {
    const entries = row.entries.map((entry) => ({
      bucketId: entry.bucketId,
      bucketName: entry.bucketName,
      collectedBy: entry.collectedBy,
      lbs: kgToLbs(entry.kg),
    }));
    return {
      id: `c${row.id}`,
      collectionNumber: row.collection_number,
      date: row.collected_on,
      entries,
      totalLbs: round(entries.reduce((sum, entry) => sum + entry.lbs, 0), 1),
      batchName: row.batch_number ?? "Unassigned",
      loggedBy: row.logged_by ?? "",
      ...(row.notes ? { notes: row.notes } : {}),
    };
  });
}

export async function getBatches() {
  const { rows } = await pool.query(
    `select bt.*,
            coalesce(bt.sap_in_kg, (
              select sum(coalesce(l.weight_kg, l.volume_collected_liters))
                from collections c join collection_logs l on l.collection_id = c.id
               where c.batch_id = bt.id), 0) as sap_kg
       from batches bt
      order by bt.started_on desc, bt.id desc`,
  );
  return rows.map((row) => ({
    id: `b${row.id}`,
    batchNumber: row.batch_number,
    date: row.started_on,
    status: row.status,
    sapInLbs: kgToLbs(row.sap_kg),
    syrupOutLbs: kgToLbs(row.syrup_out_kg),
    brix: row.brix,
    createdBy: row.created_by ?? "",
    ...(row.notes ? { notes: row.notes } : {}),
  }));
}

// ---------------------------------------------------------------------------------------------
// Seasons (Data tab: Overview and Analysis)
// ---------------------------------------------------------------------------------------------

export async function getSeasons() {
  const [collections, batches] = await Promise.all([getCollections(), getBatches()]);
  const temps = await pool.query(
    `select (measured_at at time zone $1)::date as day, avg(temperature_c) as temp_c
       from readings where temperature_c is not null group by 1`,
    [config.timeZone],
  );
  const tempByDay = new Map(temps.rows.map((row) => [row.day, row.temp_c]));

  const seasons = new Map();
  const seasonFor = (isoDate) => {
    const year = sapSeason(`${isoDate}T12:00:00Z`);
    if (!seasons.has(year)) seasons.set(year, { year, collections: [], batches: [] });
    return seasons.get(year);
  };
  collections.forEach((collection) => seasonFor(collection.date).collections.push(collection));
  batches.forEach((batch) => seasonFor(batch.date).batches.push(batch));

  return [...seasons.values()]
    .sort((a, b) => b.year - a.year)
    .map(({ year, collections: seasonCollections, batches: seasonBatches }) => {
      const totalSapLbs = round(seasonCollections.reduce((sum, c) => sum + c.totalLbs, 0), 1);
      const totalSyrupLbs = round(seasonBatches.reduce((sum, b) => sum + b.syrupOutLbs, 0), 1);
      const brixValues = seasonBatches.map((b) => b.brix).filter((value) => value > 0);
      const byDay = new Map();
      for (const collection of seasonCollections) {
        byDay.set(collection.date, (byDay.get(collection.date) ?? 0) + collection.totalLbs);
      }
      const days = [...byDay.keys()].sort();
      const dayTemps = days.map((day) => tempByDay.get(day)).filter((value) => value !== undefined);
      return {
        season: `Season ${year}`,
        totalSapLbs,
        totalSyrupLbs,
        avgBrix: brixValues.length ? round(brixValues.reduce((a, b) => a + b, 0) / brixValues.length, 1) : 0,
        sapToSyrupRatio: totalSyrupLbs > 0 ? round(totalSapLbs / totalSyrupLbs, 1) : 0,
        totalCollections: seasonCollections.length,
        totalBatches: seasonBatches.length,
        avgTempF: dayTemps.length ? Math.round(cToF(dayTemps.reduce((a, b) => a + b, 0) / dayTemps.length)) : 0,
        weeklyFlow: days.map((day) => ({
          week: monthDay(day),
          lbs: round(byDay.get(day), 1),
          temp: tempByDay.has(day) ? Math.round(cToF(tempByDay.get(day))) : 0,
        })),
      };
    });
}

// ---------------------------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------------------------

export async function getDashboard() {
  const today = localDate(new Date());
  const season = sapSeason(new Date());

  // Sap collected per day for the last 7 days: manual collections plus drops the load cells caught.
  const weekly = await pool.query(
    `select (collected_at at time zone $1)::date as day,
            sum(coalesce(weight_kg, volume_collected_liters)) as kg
       from collection_logs
      where collected_at > now() - interval '7 days'
      group by 1`,
    [config.timeZone],
  );
  const kgByDay = new Map(weekly.rows.map((row) => [row.day, row.kg]));
  const weeklyCollection = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = localDate(Date.now() - offset * 86_400_000);
    weeklyCollection.push({ day: day === today ? "Today" : weekdayOf(day), lbs: kgToLbs(kgByDay.get(day) ?? 0) });
  }

  const production = await pool.query(
    `select
       (select coalesce(sum(coalesce(weight_kg, volume_collected_liters)), 0) from collection_logs
         where sap_season(collected_at) = $1) as collected_kg,
       (select coalesce(sum(coalesce(sap_in_kg, 0)), 0) from batches
         where status in ('completed', 'processing') and sap_season(started_on::timestamptz) = $1) as processed_kg,
       (select coalesce(sum(syrup_out_kg), 0) from batches
         where sap_season(started_on::timestamptz) = $1) as syrup_kg,
       (select min(collected_at) from collection_logs where sap_season(collected_at) = $1) as first_at`,
    [season],
  );
  const totals = production.rows[0];
  const firstDay = totals.first_at ? localDate(totals.first_at) : null;

  return {
    seasonLabel: `Season ${season}`,
    currentDate: today,
    production: {
      periodLabel: firstDay ? `${monthDay(firstDay)} - Today` : "This season",
      sapCollectedLbs: kgToLbs(totals.collected_kg),
      sapProcessedLbs: kgToLbs(totals.processed_kg),
      syrupProducedLbs: kgToLbs(totals.syrup_kg),
    },
    weeklyCollection,
    kgToLbs: KG_TO_LBS,
  };
}
