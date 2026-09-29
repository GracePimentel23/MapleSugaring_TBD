/** The UI works in pounds; the database stores kilograms (and treats 1 kg of sap as 1 liter). */
export const KG_TO_LBS = 2.20462262;

export function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function kgToLbs(kg, decimals = 1) {
  return round((kg ?? 0) * KG_TO_LBS, decimals);
}

export function lbsToKg(lbs) {
  return lbs / KG_TO_LBS;
}

export function cToF(celsius) {
  return celsius * 1.8 + 32;
}
