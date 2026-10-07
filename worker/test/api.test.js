/**
 * End-to-end against a real Postgres. Creates a throwaway database next to DATABASE_URL's, runs the
 * migrations, drives the HTTP API and drops the database again. Skipped when DATABASE_URL is unset.
 *   DATABASE_URL=postgres://tbd:tbd@127.0.0.1:5433/tbd npm test
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";

const baseUrl = process.env.DATABASE_URL;
const testDb = `tbd_test_${process.pid}`;
let server;
let api;
let pool;

async function call(method, path, body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  if (!baseUrl) return;
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`create database ${testDb}`);
  await admin.end();

  const url = new URL(baseUrl);
  url.pathname = `/${testDb}`;
  process.env.DATABASE_URL = url.toString();
  const { createApp } = await import("../src/app.js");
  ({ pool } = await import("../src/db.js"));
  const { runMigrations } = await import("../src/migrate.js");
  await runMigrations(pool, () => {});
  server = createApp().listen(0);
  api = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!baseUrl) return;
  server?.close();
  await pool?.end();
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${testDb} with (force)`);
  await admin.end();
});

const skip = !baseUrl && "DATABASE_URL not set";

test("health reports the database", { skip }, async () => {
  const { status, body } = await call("GET", "/health");
  assert.equal(status, 200);
  assert.equal(body.db, "up");
});

test("a new node shows up as a station, and an unannounced drop is a bucket tipped alert", { skip }, async () => {
  const start = Date.now();
  const line = (seq, w) => ({
    type: "packet", n: seq, rssi: -50, snr: 9, crc: true, received_at: new Date(start + seq * 1000).toISOString(),
    raw: JSON.stringify({ id: "LCT", k: "live", s: seq, w, r: 1, hx: 1 }),
  });
  const first = await call("POST", "/ingest", { gateway: "GW-TEST", lines: [line(1, 4.0), line(2, 10.5), line(5, 0.2)] });
  assert.equal(first.status, 200);
  assert.equal(first.body.stored, 3);
  assert.deepEqual(first.body.results[2].events, ["tipped"]);

  // Retrying the same lines (same received_at) stores nothing new.
  const again = await call("POST", "/ingest", { gateway: "GW-TEST", lines: [line(5, 0.2)] });
  assert.equal(again.body.duplicate, 1);

  const { body } = await call("GET", "/stations");
  const station = body.stations.find((item) => item.nodeCode === "LCT");
  assert.ok(station, "station created for the new node");
  assert.equal(station.currentLbs, 0.4);
  assert.equal(station.packetsLost, 2);
  assert.equal(station.status, "attention"); // the tipped alert is open

  const alerts = await call("GET", "/alerts");
  assert.ok(alerts.body.some((alert) => alert.alert_type === "bucket_tipped" && alert.severity === "critical"));
  // 10.5 kg filled the bucket past 90%; the drop that followed cleared that alert.
  assert.ok(!alerts.body.some((alert) => alert.alert_type === "bucket_full" && alert.node_id === station.nodeId));

  const nodes = await call("GET", "/nodes");
  assert.equal(nodes.body.find((node) => node.node_code === "LCT").packets_received, 3);
});

test("a full bucket raises one alert, and logging a collection clears it", { skip }, async () => {
  const send = (seq, w) => call("POST", "/ingest", {
    gateway: "GW-TEST",
    packet: { id: "LCF", k: "live", s: seq, w, hx: 1, received_at: new Date(Date.now() + seq).toISOString() },
  });
  await send(1, 10.5);
  await send(2, 10.8);
  let open = (await call("GET", "/alerts")).body.filter((alert) => alert.alert_type === "bucket_full");
  assert.equal(open.length, 1);

  const station = (await call("GET", "/stations")).body.stations.find((item) => item.nodeCode === "LCF");
  const created = await call("POST", "/collections", { bucketIds: [station.bucketId], loggedBy: "Test" });
  assert.equal(created.status, 201);
  open = (await call("GET", "/alerts")).body.filter((alert) => alert.alert_type === "bucket_full");
  assert.equal(open.length, 0);

  const collections = (await call("GET", "/collections")).body;
  assert.equal(collections[0].entries[0].lbs, 23.8); // logged at the load cell's current weight
});

test("bad input gets a 400, not a crash", { skip }, async () => {
  assert.equal((await call("POST", "/ingest", { nope: true })).status, 400);
  assert.equal((await call("POST", "/collections", { bucketIds: [] })).status, 400);
  assert.equal((await call("PATCH", "/stations/abc", {})).status, 400);
  const mixed = await call("POST", "/ingest", { gateway: "GW-TEST", lines: ["not json", { type: "packet", crc: false, raw: "x" }] });
  assert.equal(mixed.body.rejected, 2);
});

test("batches and seasons", { skip }, async () => {
  const created = await call("POST", "/batches", { date: "2026-03-10", sapInLbs: 40, syrupOutLbs: 1, brix: 66.9 });
  assert.equal(created.status, 201);
  const batches = (await call("GET", "/batches")).body;
  assert.equal(batches[0].status, "completed");
  assert.equal(batches[0].sapInLbs, 40);
  const seasons = (await call("GET", "/seasons")).body;
  assert.ok(seasons.some((season) => season.season === "Season 2026" && season.totalSyrupLbs === 1));
});

test("live version changes when a reading lands", { skip }, async () => {
  const before = (await call("GET", "/live")).body.version;
  assert.match(before, /^\d+(\.\d+){4}$/);
  const raw = JSON.stringify({ id: "LCV", k: "live", s: 1, w: 1.5, r: 1, hx: 1 });
  await call("POST", "/ingest", { gateway: "GW-TEST", lines: [{ type: "packet", n: 1, crc: true, raw }] });
  assert.notEqual((await call("GET", "/live")).body.version, before);
});

test("demo: modes decide what a drop means, and tare and calibration change the weight", { skip }, async () => {
  let seq = 0;
  const send = (w) => {
    seq += 1;
    const raw = JSON.stringify({ id: "LCD", k: "live", s: seq, w, r: 1, hx: 1 });
    return call("POST", "/ingest", { gateway: "GW-TEST", lines: [{ type: "packet", n: seq, crc: true, raw }] });
  };
  await send(6);
  const bucketId = (await call("GET", "/stations")).body.stations.find((s) => s.nodeCode === "LCD").bucketId;

  assert.equal((await call("POST", "/demo/mode", { bucketId, mode: "collection" })).status, 200);
  assert.deepEqual((await send(0.5)).body.results[0].events, ["collected"]);
  await send(6);
  assert.equal((await call("POST", "/demo/mode", { bucketId, mode: "maintenance" })).status, 200);
  assert.deepEqual((await send(0.5)).body.results[0].events, ["maintenance"]);
  await call("POST", "/demo/mode", { bucketId, mode: "normal" });
  await send(6);
  assert.deepEqual((await send(0.5)).body.results[0].events, ["tipped"]);
  const demo = (await call("GET", `/demo?bucket=${bucketId}`)).body;
  assert.equal(demo.station.mode, "normal");
  assert.ok(demo.alerts.some((alert) => alert.alert_type === "bucket_tipped"));

  // Tare: three settled readings of 2 kg, then the scale reads 0 lbs.
  await send(2); await send(2); await send(2);
  assert.equal((await call("POST", "/demo/tare", { bucketId })).status, 200);
  assert.equal((await call("GET", `/demo?bucket=${bucketId}`)).body.station.weightLbs, 0);

  // A "25 lb plate" that the node reads as 11.0 kg net (true 11.34 kg): calibrating fixes it.
  await send(13); await send(13); await send(13);
  assert.equal((await call("POST", "/demo/calibration/points", { bucketId, knownLbs: 25 })).status, 201);
  const applied = await call("POST", "/demo/calibration/apply", { bucketId });
  assert.ok(Math.abs(applied.body.factor - 11.3398 / 11) < 0.001);
  assert.equal((await call("GET", `/demo?bucket=${bucketId}`)).body.station.weightLbs, 25);

  assert.ok((await call("POST", "/demo/clear-alerts", {})).body.cleared >= 1);
  assert.equal((await call("POST", "/demo/reset", { bucketId })).status, 200);
  const after = (await call("GET", `/demo?bucket=${bucketId}`)).body;
  assert.equal(after.station.weightLbs, null);
  assert.equal(after.alerts.length, 0);
  assert.equal((await call("POST", "/demo/test-email", {})).status, 409); // not set up in tests
});

// Runs last: once a gateway key exists, ingest without a key is refused.
test("a gateway key is required once one exists, and it names the gateway", { skip }, async () => {
  const created = await call("POST", "/gateway-keys", { gateway: "GW-KEYED" });
  assert.equal(created.status, 201);
  assert.match(created.body.key, /^tbdgw_/);

  const ingest = (key, gateway = "GW-SPOOF") => fetch(`${api}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-ingest-key": key } : {}) },
    body: JSON.stringify({ gateway, lines: [{ type: "status", role: "gateway" }] }),
  });
  assert.equal((await ingest(null)).status, 401);
  assert.equal((await ingest("tbdgw_wrong")).status, 401);
  const ok = await ingest(created.body.key);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).gateway, "GW-KEYED");

  const listed = (await call("GET", "/gateway-keys")).body;
  assert.ok(listed.some((row) => row.gateway_code === "GW-KEYED" && row.last_used_at && !("key_hash" in row)));
  assert.equal((await call("DELETE", `/gateway-keys/${created.body.id}`)).status, 200);
  assert.equal((await ingest(created.body.key)).status, 401);
});
