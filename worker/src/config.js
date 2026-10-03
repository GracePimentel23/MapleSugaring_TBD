/** Environment, read once. Everything has a local-dev default except DATABASE_URL. */
import { ROLES } from "./rbac.config.js";

function number(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number, got "${value}"`);
  return parsed;
}

function list(name, fallback = "") {
  return (process.env[name] ?? fallback)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Sign-in. Off unless AUTH_PROVIDER=google, so local dev, the simulator and the demo keep working
 * with no keys. When it is on, signed-out visitors get the guest role and every route checks the
 * caller's permissions (rbac.config.js); /health, /ingest and /auth/* need none.
 */
function authConfig() {
  const provider = (process.env.AUTH_PROVIDER ?? "").trim().toLowerCase();
  if (!provider || provider === "off") return { enabled: false };
  if (provider !== "google") throw new Error(`AUTH_PROVIDER must be "google" or unset, got "${provider}"`);

  const auth = {
    enabled: true,
    clientId: process.env.GOOGLE_CLIENT_ID?.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
    sessionSecret: process.env.SESSION_SECRET ?? "",
    // Where the browser reaches the web app; Google redirects to PUBLIC_URL/api/auth/google/callback.
    publicUrl: (process.env.PUBLIC_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
    // Google Workspace domains whose accounts may sign in (RIT's Google accounts are @g.rit.edu).
    allowedDomains: list("ALLOWED_EMAIL_DOMAINS", "g.rit.edu"),
    // Individual addresses let in whatever their domain (e.g. a teacher's personal Gmail).
    allowedEmails: list("ALLOWED_EMAILS"),
    // Made owner on every sign-in; also let in whatever their domain.
    adminEmails: list("ADMIN_EMAILS"),
    sessionDays: number("SESSION_DAYS", 30),
    // Overridable only so tests can stand in for Google.
    authorizeUrl: process.env.GOOGLE_AUTHORIZE_URL ?? "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
  };
  if (!auth.clientId || !auth.clientSecret) {
    throw new Error("AUTH_PROVIDER=google needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  }
  if (auth.sessionSecret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return auth;
}

/**
 * Local preview of one role while sign-in is off, e.g. DEV_ROLE=guest to see the signed-out view.
 * Ignored when sign-in is on. It can only take permissions away, so it is safe to leave set.
 */
function devRole(authEnabled) {
  const role = (process.env.DEV_ROLE ?? "").trim().toLowerCase();
  if (!role || authEnabled) return null;
  const choices = ["guest", ...Object.keys(ROLES)];
  if (!choices.includes(role)) throw new Error(`DEV_ROLE must be one of ${choices.join(", ")}, got "${role}"`);
  return role;
}

const auth = authConfig();

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
  auth,
  devRole: devRole(auth.enabled),
};
