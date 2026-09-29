/**
 * Parsing for what the gateway bridge sends. Mirrors Maple_Backend/frontend/packet_parser.py.
 *
 * Gateway line (USB serial, one JSON object per line):
 *   {"type":"packet","n":12,"rssi":-45.0,"snr":9.8,"len":61,"crc":true,"raw":"{\"id\":\"LC01\",...}"}
 *   {"type":"status",...} / {"type":"boot",...}
 * Node packet (inside "raw"):
 *   {"id":"LC01","k":"live","s":17,"w":3.412,"r":151234,"hx":1}   k: live | test | nohx
 */

export const NODE_KINDS = new Set(["live", "test", "nohx"]);

function finite(value) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
}

/** Accepts a gateway line as an object or a JSON string. Throws on anything unusable. */
export function parseGatewayLine(line) {
  const object = typeof line === "string" ? JSON.parse(line) : line;
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    throw new Error("gateway line must be a JSON object");
  }
  // A bare node packet (no gateway wrapper) is treated as a packet with no radio stats.
  if (object.type === undefined && object.id !== undefined) {
    return { type: "packet", raw: JSON.stringify(object), receivedAt: object.received_at ?? null };
  }
  return {
    type: String(object.type ?? "unknown"),
    gatewaySeq: finite(object.n),
    rssi: finite(object.rssi),
    snr: finite(object.snr),
    crcOk: object.crc === undefined ? null : Boolean(object.crc),
    raw: typeof object.raw === "string" ? object.raw : object.raw ? JSON.stringify(object.raw) : null,
    receivedAt: object.received_at ?? null,
    extra: object,
  };
}

/** Parses the node's compact JSON. Throws with a readable message if it is not one of ours. */
export function parseNodePacket(raw) {
  let object;
  try {
    object = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("payload is not JSON");
  }
  if (!object || typeof object !== "object") throw new Error("payload is not an object");

  const nodeCode = typeof object.id === "string" ? object.id.trim() : "";
  if (!nodeCode || nodeCode.length > 32) throw new Error("missing or invalid node id");

  const kind = NODE_KINDS.has(object.k) ? object.k : "live";
  const weightKg = finite(object.w);
  if (kind !== "nohx" && weightKg === null) throw new Error("missing weight");

  return {
    nodeCode,
    kind,
    seq: finite(object.s),
    weightKg: kind === "nohx" ? null : weightKg,
    rawCounts: finite(object.r),
    hxOk: object.hx === undefined ? kind !== "nohx" : Boolean(object.hx),
    uncalibrated: Boolean(object.uncal),
    batteryV: finite(object.v),
    temperatureC: finite(object.t),
    testStep: finite(object.i),
    testOf: finite(object.of),
  };
}
