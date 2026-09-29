/**
 * Demo data matching web/lib/data/mock.ts and records.ts, with dates moved relative to today so the
 * dashboard looks current. Only runs on an empty database unless --force is passed, which wipes the
 * app tables first (never run --force on the VM once real readings exist).
 *
 *   npm run seed            # seed if empty
 *   npm run seed -- --force # wipe and reseed
 */
import { pool, withTransaction } from "../src/db.js";
import { runMigrations } from "../src/migrate.js";
import { lbsToKg } from "../src/domain/units.js";

const force = process.argv.includes("--force");
const DAY = 86_400_000;
const daysAgo = (days, hour = 9) => {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, 30, 0, 0);
  return date;
};
const dateOnly = (date) => date.toISOString().slice(0, 10);

const CAPACITY_KG = lbsToKg(12);
const stations = [
  { code: "Bucket #01", species: "Sugar Maple", battery: 88.5, trendLbs: [2.1, 3.8, 5.2, 6.9, 7.4, 8.0, 8.4] },
  { code: "Bucket #02", species: "Sugar Maple", battery: 91.0, trendLbs: [2.1, 3.8, 5.2, 6.9, 7.4, 8.6, 9.4] },
  { code: "Bucket #03", species: "Red Maple", battery: 84.25, trendLbs: [2.1, 3.8, 5.2, 6.9, 7.4, 8.6, 9.4] },
  { code: "Bucket #04", species: "Sugar Maple", battery: 76.5, trendLbs: [4.0, 6.2, 7.8, 9.1, 10.0, 10.9, 11.4] },
  { code: "Bucket #05", species: "Black Maple", battery: 64.0, trendLbs: [0.8, 1.9, 2.8, 3.7, 4.5, 5.4, 6.2] },
];

// records.ts: last season's collections and batches.
const pastBatches = [
  { number: "Batch #01", date: "2022-03-06", status: "completed", sapLbs: 22.1, syrupLbs: 0.9, brix: 66.4, by: "Mr. Adams" },
  { number: "Batch #02", date: "2022-03-08", status: "completed", sapLbs: 27, syrupLbs: 1.1, brix: 66.8, by: "Mr. Adams", notes: "Best clarity of the season." },
  { number: "Batch #03", date: "2022-03-11", status: "completed", sapLbs: 16.7, syrupLbs: 0.7, brix: 66.5, by: "Sam R." },
];
const pastCollections = [
  { date: "2022-03-06", batch: "Batch #01", by: "Chloe M.", notes: "Bucket #03 was pegged at capacity overnight - cleared both before the warm front moved in.", entries: [[1, "Chloe M.", 10.1], [3, "Chloe M.", 12]] },
  { date: "2022-03-08", batch: "Batch #02", by: "Mr. Adams", notes: "Snow moving in - pulled three buckets indoors and emptied them before carrying them in.", entries: [[2, "Mr. Adams", 10.3], [4, "Jordan T.", 9.4], [5, "Jordan T.", 7.3]] },
  { date: "2022-03-11", batch: "Batch #03", by: "Sam R.", notes: "Collected to feed the evaporator - best freeze-thaw run of the season.", entries: [[1, "Sam R.", 7.5], [3, "Sam R.", 9.2]] },
];

await runMigrations(pool);
const { rows } = await pool.query("select count(*)::int as count from buckets");
if (rows[0].count > 0 && !force) {
  console.log(`database already has ${rows[0].count} buckets; skipping seed (use --force to wipe and reseed)`);
  await pool.end();
  process.exit(0);
}

await withTransaction(async (client) => {
  if (force) {
    await client.query(`truncate collection_logs, collections, batches, metrics, alerts, readings, raw_packets,
                        buckets, node, gateway, users, roles restart identity cascade`);
  }
  await client.query(`insert into roles (role_name) values ('admin'), ('member'), ('viewer') on conflict (role_name) do nothing`);
  await client.query(`insert into users (role_id, full_name, email) values
                        ((select id from roles where role_name = 'admin'), 'Maple Club Lead', 'lead@maplesugaring.club'),
                        ((select id from roles where role_name = 'member'), 'Alex Rivera', 'alex@maplesugaring.club')`);
  const gateway = await client.query(
    `insert into gateway (gateway_code, gateway_name, ip_address, status, last_ping)
     values ('GW-NORTH-01', 'North grove gateway', '10.20.0.12', 'online', now()) returning id`,
  );

  const bucketIds = [];
  for (const [index, station] of stations.entries()) {
    const node = await client.query(
      `insert into node (gateway_id, node_code, node_name, battery_level, status, installed_at)
       values ($1, $2, $2, $3, 'online', $4) returning id`,
      [gateway.rows[0].id, station.code, station.battery, daysAgo(200)],
    );
    const bucket = await client.query(
      `insert into buckets (node_id, label, tree_species, capacity_liters, installed_at)
       values ($1, $2, $3, $4, $5) returning id`,
      [node.rows[0].id, station.code, station.species, CAPACITY_KG, daysAgo(200)],
    );
    bucketIds.push(bucket.rows[0].id);
    for (const [day, lbs] of station.trendLbs.entries()) {
      const isLatest = day === station.trendLbs.length - 1;
      await client.query(
        `insert into metrics (node_id, bucket_id, fill_level_percent, sap_flow_rate_lph, recorded_at)
         values ($1, $2, $3, $4, $5)`,
        [node.rows[0].id, bucket.rows[0].id, (lbs / 12) * 100, isLatest ? 0.42 : 0.55,
          isLatest ? new Date(Date.now() - 20 * 60_000) : daysAgo(6 - day)],
      );
    }
    if (index === 3) {
      await client.query(
        `insert into alerts (node_id, bucket_id, alert_type, severity, message, dedupe_key)
         values ($1, $2, 'high_fill', 'warning', 'Bucket nearing capacity', $3)`,
        [node.rows[0].id, bucket.rows[0].id, `seed:high_fill:${bucket.rows[0].id}`],
      );
    }
  }

  async function addBatch(batch) {
    const result = await client.query(
      `insert into batches (batch_number, started_on, status, sap_in_kg, syrup_out_kg, brix, created_by, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [batch.number, batch.date, batch.status, batch.sapLbs === null ? null : lbsToKg(batch.sapLbs),
        lbsToKg(batch.syrupLbs), batch.brix, batch.by, batch.notes ?? null],
    );
    return result.rows[0].id;
  }

  async function addCollection(collection, batchId, at) {
    const result = await client.query(
      `insert into collections (collected_on, batch_id, logged_by, notes) values ($1, $2, $3, $4) returning id`,
      [collection.date, batchId, collection.by, collection.notes ?? null],
    );
    for (const [bucketNumber, collectedBy, lbs] of collection.entries) {
      const bucketId = bucketIds[bucketNumber - 1];
      await client.query(
        `insert into collection_logs (collection_id, user_id, node_id, bucket_id, volume_collected_liters,
                                      weight_kg, collected_by, collected_at)
         select $1, 2, node_id, id, $2, $2, $3, $4 from buckets where id = $5`,
        [result.rows[0].id, lbsToKg(lbs), collectedBy, at, bucketId],
      );
    }
  }

  const pastBatchIds = new Map();
  for (const batch of pastBatches) pastBatchIds.set(batch.number, await addBatch(batch));
  for (const collection of pastCollections) {
    await addCollection(collection, pastBatchIds.get(collection.batch), new Date(`${collection.date}T15:00:00Z`));
  }

  // This season: the weekly chart and production summary read these.
  const currentBatch = await addBatch({
    number: "Batch #04", date: dateOnly(daysAgo(5)), status: "active", sapLbs: null, syrupLbs: 0, brix: 0,
    by: "Mr. Adams", notes: "Open batch - new collections are going into this one.",
  });
  const recent = [
    [5, [[1, "Alex R.", 5.2]]],
    [4, [[2, "Alex R.", 4.6]]],
    [3, [[3, "Sam R.", 3.0]]],
    [2, [[5, "Chloe M.", 3.8]]],
    [0, [[4, "Jordan T.", 1.9]]],
  ];
  for (const [ago, entries] of recent) {
    const at = daysAgo(ago, 16);
    await addCollection({ date: dateOnly(at), by: entries[0][1], entries }, currentBatch, at);
  }
});

console.log("seeded demo data: 5 stations, 3 past batches + 1 open batch, 8 collections");
await pool.end();
