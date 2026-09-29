export const LITERS_TO_LBS = 2.20462262;

export function litersToLbs(liters: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(liters * LITERS_TO_LBS * factor) / factor;
}

export function lbsToLiters(lbs: number): number {
  return lbs / LITERS_TO_LBS;
}

export function formatLbsNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatLbs(value: number): string {
  return `${formatLbsNumber(value)} lbs`;
}
