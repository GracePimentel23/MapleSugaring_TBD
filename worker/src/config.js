/** Environment, read once. Everything has a local-dev default except DATABASE_URL. */

function number(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number, got "${value}"`);
  return parsed;
}

export const config = {
  port: number("PORT", 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://tbd:tbd@127.0.0.1:5433/tbd",
  // Gateways must send this in X-Ingest-Key. Unset means ingest is open (local dev only).
  ingestKey: process.env.INGEST_KEY || null,
  // Browser timezone for "Updated 9:30AM" labels and day buckets.
  timeZone: process.env.TZ_DISPLAY ?? "America/New_York",
  offlineAfterMinutes: number("OFFLINE_AFTER_MINUTES", 15),
  metricIntervalMinutes: number("METRIC_INTERVAL_MINUTES", 15),
  fullPercent: number("FULL_PERCENT", 90),
  migrateOnBoot: process.env.MIGRATE_ON_BOOT !== "false",
};
