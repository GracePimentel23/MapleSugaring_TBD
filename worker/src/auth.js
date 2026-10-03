/**
 * Google sign-in (OpenID Connect authorization code flow with PKCE) and cookie sessions.
 *
 * The browser only ever talks to the web app: /api/auth/* is proxied here, so the cookies belong to
 * the web origin. Flow: GET /auth/google -> Google -> GET /auth/google/callback -> session cookie -> "/".
 * Who may sign in is decided here from the ID token, never from anything the browser sends.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { config } from "./config.js";
import { pool, withTransaction } from "./db.js";
import { accessFor, ASSIGNABLE_ROLES, describeAccess, GUEST_ROLE, NEW_USER_ROLE, OWNER_ROLE } from "./rbac.js";

export const SESSION_COOKIE = "tbd_session";
/** The "View as" test switch in the profile menu. Only read while sign-in is off. */
export const VIEW_AS_COOKIE = "tbd_view_as";
/** What "View as" offers: "all" (no limits) or one view. */
export const VIEW_AS_CHOICES = ["all", GUEST_ROLE, ...ASSIGNABLE_ROLES];
const STATE_COOKIE = "tbd_oauth";
const STATE_MAX_AGE_S = 10 * 60;
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

// ---- pure helpers (unit tested) -----------------------------------------------------------------

const base64url = (buffer) => Buffer.from(buffer).toString("base64url");
const hmac = (value, secret) => createHmac("sha256", secret).update(value).digest("base64url");
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

/** "value.signature", so a cookie cannot be forged or altered without SESSION_SECRET. */
export function sign(value, secret) {
  return `${value}.${hmac(value, secret)}`;
}

/** The value from sign(), or null if the signature does not match. */
export function unsign(signed, secret) {
  if (typeof signed !== "string") return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const given = Buffer.from(signed.slice(dot + 1));
  const expected = Buffer.from(hmac(value, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? value : null;
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in cookies) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // ignore malformed cookies
    }
  }
  return cookies;
}

export function serializeCookie(name, value, { maxAge, path = "/", secure = false } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, "HttpOnly", "SameSite=Lax"];
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Payload of a JWT. Only used on tokens received straight from Google's token endpoint over TLS. */
export function decodeJwtPayload(jwt) {
  const parts = String(jwt ?? "").split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

/**
 * OIDC checks on the ID token claims. The signature check is skipped because the token came
 * directly from Google's token endpoint over HTTPS in exchange for our client secret (OIDC Core 3.1.3.7).
 */
export function validateIdClaims(claims, { clientId, nonce, now = Date.now() }) {
  if (!GOOGLE_ISSUERS.has(claims.iss)) return "bad_issuer";
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(clientId)) return "bad_audience";
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now - 60_000) return "expired";
  if (!nonce || claims.nonce !== nonce) return "bad_nonce";
  if (!claims.sub) return "no_subject";
  return null;
}

/**
 * Who may sign in, from the ID token claims:
 *  - the email must be verified by Google;
 *  - an address in ADMIN_EMAILS or ALLOWED_EMAILS is let in as is;
 *  - otherwise both the email's domain and the `hd` claim must be in ALLOWED_EMAIL_DOMAINS. `hd` is only
 *    set for Google Workspace accounts, so a personal Google account registered with an @rit.edu address
 *    (which Google marks verified) is still refused.
 * Returns { ok, email, name, sub, admin } or { ok: false, reason }; admin means "make them owner".
 */
export function checkAccount(claims, { allowedDomains = [], allowedEmails = [], adminEmails = [] }) {
  const email = String(claims.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, reason: "no_email" };
  if (claims.email_verified !== true && claims.email_verified !== "true") return { ok: false, reason: "email_not_verified" };

  const admin = adminEmails.includes(email);
  const domain = email.slice(email.lastIndexOf("@") + 1);
  const hostedDomain = String(claims.hd ?? "").toLowerCase();
  const listed = admin || allowedEmails.includes(email);
  const domainOk = allowedDomains.includes(domain) && allowedDomains.includes(hostedDomain);
  if (!listed && !domainOk) return { ok: false, reason: "domain_not_allowed" };

  return { ok: true, email, sub: String(claims.sub), name: String(claims.name ?? "").trim() || email, admin };
}

/** Only same-site paths, so the callback cannot be turned into an open redirect. */
export function safeReturnTo(value) {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") && !path.startsWith("/api/")
    ? path
    : "/";
}

// ---- sessions ----------------------------------------------------------------------------------

const secureCookies = () => config.auth.publicUrl.startsWith("https://");

async function createSession(userId) {
  const token = base64url(randomBytes(32));
  await pool.query(
    `insert into sessions (id, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), userId, config.auth.sessionDays],
  );
  return serializeCookie(SESSION_COOKIE, sign(token, config.auth.sessionSecret), {
    maxAge: config.auth.sessionDays * 86400,
    secure: secureCookies(),
  });
}

function sessionToken(req) {
  return unsign(parseCookies(req.get("cookie"))[SESSION_COOKIE], config.auth.sessionSecret);
}

async function loadSessionUser(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const { rows } = await pool.query(
    `select u.id, u.email, u.full_name as name, r.role_name as role
       from sessions s join users u on u.id = s.user_id left join roles r on r.id = u.role_id
      where s.id = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  const user = rows[0];
  if (!user) return null;
  // No role yet, or one that was removed from rbac.config.js: treat as a new user.
  if (!ASSIGNABLE_ROLES.includes(user.role)) user.role = NEW_USER_ROLE;
  return user;
}

/** Finds or creates the user for a Google account; ADMIN_EMAILS are (re)made admin on every sign-in. */
async function upsertUser(account) {
  return withTransaction(async (client) => {
    const found = await client.query(
      `select u.id, u.google_sub, r.role_name as role from users u left join roles r on r.id = u.role_id
        where u.google_sub = $1 or lower(u.email) = $2
        order by (u.google_sub = $1) desc nulls last limit 1`,
      [account.sub, account.email],
    );
    const existing = found.rows[0];
    // The address was linked to a different Google account before (e.g. a recycled address).
    if (existing?.google_sub && existing.google_sub !== account.sub) return null;

    if (existing) {
      await client.query(
        `update users set google_sub = $2, email = $3, full_name = $4, last_login_at = now(),
                role_id = case when $5 then (select id from roles where role_name = $6)
                               else coalesce(role_id, (select id from roles where role_name = $7)) end
          where id = $1`,
        [existing.id, account.sub, account.email, account.name, account.admin, OWNER_ROLE, NEW_USER_ROLE],
      );
      if (account.admin && existing.role !== OWNER_ROLE) {
        await client.query(
          `insert into audit_log (entity, entity_id, action, before, after, reason)
           values ('user', $1, 'role_change', $2, $3, 'listed in ADMIN_EMAILS')`,
          [String(existing.id), { role: existing.role ?? null }, { role: OWNER_ROLE }],
        );
      }
      return existing.id;
    }
    const inserted = await client.query(
      `insert into users (full_name, email, google_sub, last_login_at, role_id)
       values ($1, $2, $3, now(), (select id from roles where role_name = $4)) returning id`,
      [account.name, account.email, account.sub, account.admin ? OWNER_ROLE : NEW_USER_ROLE],
    );
    return inserted.rows[0].id;
  });
}

// ---- routes ------------------------------------------------------------------------------------

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const redirectUri = () => `${config.auth.publicUrl}/api/auth/google/callback`;

function fail(res, reason) {
  res.append("Set-Cookie", serializeCookie(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth", secure: secureCookies() }));
  res.redirect(302, `${config.auth.publicUrl}/?auth_error=${encodeURIComponent(reason)}`);
}

export function authRouter() {
  const router = Router();

  // Who is asking and what they may see: { authEnabled, user, role, permissions, components }.
  // viewAs is only offered with sign-in off (local testing): the choices for the profile menu.
  router.get("/auth/me", (req, res) => {
    res.json({
      authEnabled: config.auth.enabled,
      user: req.user,
      ...describeAccess(req.access),
      viewAs: config.auth.enabled ? null : VIEW_AS_CHOICES,
    });
  });

  router.post("/auth/logout", wrap(async (req, res) => {
    if (config.auth.enabled) {
      const token = sessionToken(req);
      if (token) await pool.query("delete from sessions where id = $1", [hashToken(token)]);
      res.append("Set-Cookie", serializeCookie(SESSION_COOKIE, "", { maxAge: 0, secure: secureCookies() }));
    }
    res.json({ ok: true });
  }));

  router.get("/auth/google", (req, res) => {
    if (!config.auth.enabled) return res.status(404).json({ error: "sign-in is not enabled" });
    const state = base64url(randomBytes(16));
    const nonce = base64url(randomBytes(16));
    const verifier = base64url(randomBytes(32));
    const payload = base64url(JSON.stringify({
      state, nonce, verifier, returnTo: safeReturnTo(req.query.returnTo), exp: Date.now() + STATE_MAX_AGE_S * 1000,
    }));
    res.append("Set-Cookie", serializeCookie(STATE_COOKIE, sign(payload, config.auth.sessionSecret), {
      maxAge: STATE_MAX_AGE_S, path: "/api/auth", secure: secureCookies(),
    }));

    const url = new URL(config.auth.authorizeUrl);
    url.search = new URLSearchParams({
      client_id: config.auth.clientId,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      // Only a hint for Google's account picker: one domain pins it, "*" asks for any Workspace account.
      hd: config.auth.allowedDomains.length === 1 ? config.auth.allowedDomains[0] : "*",
      prompt: "select_account",
    }).toString();
    res.redirect(302, url.toString());
  });

  router.get("/auth/google/callback", wrap(async (req, res) => {
    if (!config.auth.enabled) return res.status(404).json({ error: "sign-in is not enabled" });
    if (req.query.error) return fail(res, "cancelled");

    const raw = unsign(parseCookies(req.get("cookie"))[STATE_COOKIE], config.auth.sessionSecret);
    let saved = null;
    try {
      saved = raw && JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    } catch {
      saved = null;
    }
    if (!saved || saved.exp < Date.now() || saved.state !== req.query.state || !req.query.code) {
      return fail(res, "expired");
    }

    const tokenResponse = await fetch(config.auth.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: config.auth.clientId,
        client_secret: config.auth.clientSecret,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
        code_verifier: saved.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.id_token) {
      console.error("google token exchange failed", tokenResponse.status, tokens.error);
      return fail(res, "google_error");
    }

    let claims;
    try {
      claims = decodeJwtPayload(tokens.id_token);
    } catch {
      return fail(res, "google_error");
    }
    const invalid = validateIdClaims(claims, { clientId: config.auth.clientId, nonce: saved.nonce });
    if (invalid) {
      console.error("rejected google id_token:", invalid);
      return fail(res, "google_error");
    }
    const account = checkAccount(claims, config.auth);
    if (!account.ok) return fail(res, account.reason);

    const userId = await upsertUser(account);
    if (!userId) return fail(res, "account_mismatch");
    await pool.query("delete from sessions where expires_at < now()");

    res.append("Set-Cookie", serializeCookie(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth", secure: secureCookies() }));
    res.append("Set-Cookie", await createSession(userId));
    res.redirect(302, `${config.auth.publicUrl}${safeReturnTo(saved.returnTo)}`);
  }));

  return router;
}

/**
 * Works out who is asking: req.user (the signed-in user, or null) and req.access ({ role, permissions }).
 * Never refuses anything itself; each route checks req.access with requirePermission().
 */
export function identify() {
  return wrap(async (req, _res, next) => {
    req.user = config.auth.enabled ? await loadSessionUser(req) : null;
    req.access = accessFor({ authEnabled: config.auth.enabled, user: req.user, devRole: previewRole(req) });
    next();
  });
}

/**
 * With sign-in off, which role to act as: the "View as" cookie if set, else DEV_ROLE, else none (all).
 * With sign-in on it is always null, so the cookie can never change what a signed-in person may do.
 */
export function previewRole(req, { authEnabled = config.auth.enabled, devRole = config.devRole } = {}) {
  if (authEnabled) return null;
  const chosen = parseCookies(req.get("cookie"))[VIEW_AS_COOKIE];
  if (chosen === "all") return null;
  return VIEW_AS_CHOICES.includes(chosen) ? chosen : devRole;
}
