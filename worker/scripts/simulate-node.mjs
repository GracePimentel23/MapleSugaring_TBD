/**
 * Pretends to be the gateway bridge: posts load cell packets to the worker the same way the real
 * gateway lines arrive. Handy when the LoRa32 boards are not plugged in.
 *
 *   npm run simulate                      # PRG-button test loop: ramp 0.25 -> 9.25 kg, then a drop
 *   npm run simulate -- --live --count 30 # slow live readings that creep up
 *   options: --url http://localhost:4000 --node LC01 --gateway GW-SIM --delay 1500 --key <INGEST_KEY>
 */
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const url = option("url", process.env.WORKER_URL ?? "http://localhost:4000");
const node = option("node", "LC01");
const gateway = option("gateway", "GW-SIM");
const delay = Number(option("delay", "1500"));
const key = option("key", process.env.INGEST_KEY ?? "");
const live = args.includes("--live");
const count = Number(option("count", live ? "30" : "20"));

let seq = 0; // like a freshly booted node; a lower number than last time reads as a reboot, not packet loss
let gatewaySeq = 0;

async function send(payload) {
  seq += 1;
  gatewaySeq += 1;
  const raw = JSON.stringify({ id: node, s: seq, r: Math.round(payload.w * 42000), hx: 1, ...payload });
  const line = {
    type: "packet", n: gatewaySeq, rssi: -40 - Math.round(Math.random() * 30), snr: 8 + Math.random() * 3,
    len: raw.length, crc: true, raw, received_at: new Date().toISOString(),
  };
  const response = await fetch(`${url}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-ingest-key": key } : {}) },
    body: JSON.stringify({ gateway, lines: [line] }),
  });
  const body = await response.json();
  const result = body.results?.[0] ?? body;
  console.log(`${response.status} ${payload.k} w=${payload.w.toFixed(3)} kg -> ${result.status ?? result.error}` +
    (result.events?.length ? ` [${result.events.join(", ")}]` : ""));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (live) {
  let weight = 0.5;
  for (let i = 0; i < count; i += 1) {
    weight += 0.05 + Math.random() * 0.1;
    await send({ k: "live", w: Math.round(weight * 1000) / 1000 });
    await sleep(delay);
  }
} else {
  // Same shape as the node's PRG-button test loop: 19 steps up, then the bucket is emptied.
  for (let step = 1; step <= count; step += 1) {
    const w = step < count ? 0.25 + ((9.25 - 0.25) * (step - 1)) / (count - 2) : 0.15;
    await send({ k: "test", w: Math.round(w * 1000) / 1000, i: step, of: count });
    await sleep(delay);
  }
}
