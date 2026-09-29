/** Pure rules the ingest path applies to each reading. Thresholds match Maple_Backend/README.md. */

export const WEIGHT_MIN_KG = -1;
export const WEIGHT_MAX_KG = 55;

/** Percent of the bucket's capacity the sap fills (1 kg of sap ~ 1 L, as in the UI). */
export function fillPercent(weightKg, tareKg, capacityLiters) {
  if (weightKg === null || weightKg === undefined || !capacityLiters) return 0;
  const net = Math.max(weightKg - (tareKg ?? 0), 0);
  return Math.round((net / capacityLiters) * 1000) / 10;
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
