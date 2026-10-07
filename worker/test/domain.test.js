import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGatewayLine, parseNodePacket } from "../src/domain/packet.js";
import { fillPercent, flowRateLph, isOutOfRange, isSuddenDrop, lostBetween, netKg, currentMode, calibrationFactor } from "../src/domain/rules.js";
import { kgToLbs, lbsToKg } from "../src/domain/units.js";

test("parses a gateway packet line from the README", () => {
  const line = parseGatewayLine(
    '{"type":"packet","n":12,"rssi":-45.0,"snr":9.8,"len":61,"crc":true,"raw":"{\\"id\\":\\"LC01\\",\\"k\\":\\"live\\",\\"s\\":17,\\"w\\":3.412,\\"r\\":151234,\\"hx\\":1}"}',
  );
  assert.equal(line.type, "packet");
  assert.equal(line.gatewaySeq, 12);
  assert.equal(line.rssi, -45);
  assert.equal(line.crcOk, true);
  const packet = parseNodePacket(line.raw);
  assert.deepEqual(
    { id: packet.nodeCode, kind: packet.kind, seq: packet.seq, w: packet.weightKg, r: packet.rawCounts, hx: packet.hxOk },
    { id: "LC01", kind: "live", seq: 17, w: 3.412, r: 151234, hx: true },
  );
});

test("a bare node packet is accepted as a packet line", () => {
  const line = parseGatewayLine({ id: "LC01", k: "test", s: 3, w: 1.5, i: 3, of: 20 });
  assert.equal(line.type, "packet");
  const packet = parseNodePacket(line.raw);
  assert.equal(packet.kind, "test");
  assert.equal(packet.testStep, 3);
  assert.equal(packet.testOf, 20);
});

test("nohx heartbeats need no weight; live packets do", () => {
  assert.equal(parseNodePacket('{"id":"LC01","k":"nohx","s":1,"hx":0}').weightKg, null);
  assert.throws(() => parseNodePacket('{"id":"LC01","k":"live","s":1}'), /missing weight/);
  assert.throws(() => parseNodePacket("hello"), /not JSON/);
  assert.throws(() => parseNodePacket('{"w":1}'), /node id/);
  assert.equal(parseNodePacket('{"id":"LC01","w":1,"uncal":1}').uncalibrated, true);
});

test("sudden drop needs at least 1 kg and at least half", () => {
  assert.equal(isSuddenDrop(9.25, 0.15), true);
  assert.equal(isSuddenDrop(1.5, 0.4), true);
  assert.equal(isSuddenDrop(10, 8.5), false); // 1.5 kg but not half
  assert.equal(isSuddenDrop(1.2, 0.5), false); // half but under 1 kg
  assert.equal(isSuddenDrop(null, 0.1), false);
});

test("fill, range, packet loss and flow", () => {
  assert.equal(fillPercent(5.68, 0, 11.36), 50);
  assert.equal(fillPercent(1, 2, 11.36), 0);
  assert.equal(isOutOfRange(56), true);
  assert.equal(isOutOfRange(-0.5), false);
  assert.equal(lostBetween(10, 13), 2);
  assert.equal(lostBetween(10, 2), 0); // node rebooted
  assert.equal(lostBetween(null, 5), 0);
  assert.equal(flowRateLph(1, "2026-03-01T10:00:00Z", 1.5, "2026-03-01T11:00:00Z"), 0.5);
  assert.equal(flowRateLph(2, "2026-03-01T10:00:00Z", 1, "2026-03-01T11:00:00Z"), 0);
});

test("units round-trip", () => {
  assert.equal(kgToLbs(lbsToKg(12)), 12);
  assert.equal(kgToLbs(1), 2.2);
});

test("net weight applies tare and calibration", () => {
  assert.equal(netKg(5, { tare_kg: 1, calibration_factor: 1.5 }), 6);
  assert.equal(netKg(null, {}), null);
  assert.equal(netKg(2, null), 2);
});

test("collection and maintenance mode end by themselves", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  assert.equal(currentMode({ mode: "collection", mode_until: "2026-10-07T12:30:00Z" }, now), "collection");
  assert.equal(currentMode({ mode: "maintenance", mode_until: "2026-10-07T11:59:00Z" }, now), "normal");
  assert.equal(currentMode({ mode: "normal" }, now), "normal");
  assert.equal(currentMode({ mode: "bogus", mode_until: "2026-10-08T00:00:00Z" }, now), "normal");
});

test("calibration factor from known weights", () => {
  // The scale reads 2% low on every plate.
  const points = [5, 10, 25, 45].map((lbs) => ({ knownKg: lbs * 0.4536, measuredKg: lbs * 0.4536 * 0.98 }));
  assert.ok(Math.abs(calibrationFactor(points) - 1 / 0.98) < 0.0001);
  assert.equal(calibrationFactor([]), null);
  assert.equal(calibrationFactor([{ knownKg: 10, measuredKg: 1 }]), null); // 10x off: a mistake, not a calibration
});
