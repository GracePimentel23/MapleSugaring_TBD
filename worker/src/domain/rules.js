/** Pure rules the ingest path applies to each reading. Thresholds match Maple_Backend/README.md. */

export const WEIGHT_MIN_KG = -1;
export const WEIGHT_MAX_KG = 55;

/** Percent of the bucket's capacity the sap fills (1 kg of sap ~ 1 L, as in the UI). */
export function fillPercent(weightKg, tareKg, capacityLiters, factor = 1) {
  if (weightKg === null || weightKg === undefined || !capacityLiters) return 0;
  const net = Math.max((weightKg - (tareKg ?? 0)) * factor, 0);
  return Math.round((net / capacityLiters) * 1000) / 10;
}

/** Net weight on the scale in kg: the node's reading minus the bucket's tare, times its calibration. */
export function netKg(rawKg, bucket) {
  if (rawKg === null || rawKg === undefined) return null;
  return (rawKg - Number(bucket?.tare_kg ?? 0)) * Number(bucket?.calibration_factor ?? 1);
}

export const MODES = ["normal", "collection", "maintenance"];

/** The bucket's mode right now: collection and maintenance end by themselves at mode_until. */
export function currentMode(bucket, now = new Date()) {
  const mode = bucket?.mode ?? "normal";
  if (mode === "normal") return "normal";
  if (bucket.mode_until && new Date(bucket.mode_until) <= now) return "normal";
  return MODES.includes(mode) ? mode : "normal";
}

/** A normal calibration moves the reading by at most this much (2x either way); more needs force. */
export const CALIBRATION_NORMAL = [0.5, 2];
/** Even forced, the factor stays in what calibration_factor numeric(8, 5) holds and makes sense. */
export const CALIBRATION_FORCED = [0.01, 500];

/**
 * Least squares fit through zero of known against measured weight, so a 45 lb plate counts more
 * than a 5 lb one. Points are { knownKg, measuredKg } with measured net of tare. null if no usable point.
 */
export function calibrationFit(points) {
  let top = 0;
  let bottom = 0;
  for (const { knownKg, measuredKg } of points) {
    top += Number(knownKg) * Number(measuredKg);
    bottom += Number(measuredKg) ** 2;
  }
  if (!bottom) return null;
  return Math.round((top / bottom) * 100_000) / 100_000;
}

/**
 * Calibration factor from known weights, or null if unusable. Without force a factor more than 2x
 * off is taken for a mistake (wrong weight typed, scale not tared); force accepts anything sane,
 * e.g. for a node still on its default counts per kg.
 */
export function calibrationFactor(points, { force = false } = {}) {
  const factor = calibrationFit(points);
  const [min, max] = force ? CALIBRATION_FORCED : CALIBRATION_NORMAL;
  return factor !== null && factor > min && factor < max ? factor : null;
}

/** Collected or knocked over: weight falls by at least 1 kg and by at least half. */
export function isSuddenDrop(previousKg, currentKg) {
  if (previousKg === null || previousKg === undefined) return false;
  if (currentKg === null || currentKg === undefined) return false;
  const drop = previousKg - currentKg;
  return drop >= 1 && drop >= previousKg * 0.5;
}

export function isOutOfRange(weightKg) {
  return weightKg !== null && (weightKg < WEIGHT_MIN_KG || weightKg > WEIGHT_MAX_KG);
}

/**
 * Packets missed between two sequence numbers. A smaller number means the node rebooted,
 * which is not a loss.
 */
export function lostBetween(lastSeq, seq) {
  if (lastSeq === null || lastSeq === undefined || seq === null || seq === undefined) return 0;
  const gap = seq - lastSeq - 1;
  return gap > 0 && gap < 10_000 ? gap : 0;
}

/** Liters per hour between two weights (kg ~ L), never negative. */
export function flowRateLph(previousKg, previousAt, currentKg, currentAt) {
  if (previousKg === null || currentKg === null || !previousAt || !currentAt) return 0;
  const hours = (new Date(currentAt) - new Date(previousAt)) / 3_600_000;
  if (hours <= 0) return 0;
  return Math.max(Math.round(((currentKg - previousKg) / hours) * 100) / 100, 0);
}
