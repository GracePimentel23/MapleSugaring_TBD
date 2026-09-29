/**
 * Google sign-in end to end with AUTH_PROVIDER=google, against a real Postgres and a fake Google token
 * endpoint. Same throwaway-database setup as api.test.js; skipped when DATABASE_URL is unset.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import pg from "pg";

const baseUrl = process.env.DATABASE_URL;
const testDb = `tbd_auth_test_${process.pid}`;
const CLIENT_ID = "test-client.apps.googleusercontent.com";
const PUBLIC_URL = "http://web.test";
let server;
let google;
let api;
let pool;
// What the fake Google puts in the next ID token; the nonce is filled in from the sign-in redirect.
let nextClaims = {};
let lastTokenRequest = null;

function fakeIdToken(claims) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.sig`;
}

before(async () => {
  if (!baseUrl) return;
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`create database ${testDb}`);
  await admin.end();

  google = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      lastTokenRequest = Object.fromEntries(new URLSearchParams(body));
      res.setHeader("content-type", "application/json");
      if (lastTokenRequest.code !== "good-code") {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "invalid_grant" }));
      }
      res.end(JSON.stringify({ id_token: fakeIdToken(nextClaims), access_token: "unused" }));
    });
  }).listen(0);

  const url = new URL(baseUrl);
  url.pathname = `/${testDb}`;
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    AUTH_PROVIDER: "google",
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: "test-secret",
    GOOGLE_TOKEN_URL: `http://127.0.0.1:${google.address().port}/token`,
    SESSION_SECRET: "x".repeat(48),
    PUBLIC_URL,
    ALLOWED_EMAIL_DOMAINS: "g.rit.edu",
    ALLOWED_EMAILS: "teacher@gmail.com",
    ADMIN_EMAILS: "boss@g.rit.edu",
  });
  const { createApp } = await import("../src/app.js");
  ({ pool } = await import("../src/db.js"));
  const { runMigrations } = await import("../src/migrate.js");
  await runMigrations(pool, () => {});
  server = createApp().listen(0);
  api = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!baseUrl) return;
  server?.close();
  google?.close();
  await pool?.end();
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${testDb} with (force)`);
  await admin.end();
});

const skip = !baseUrl && "DATABASE_URL not set";

/** "name=value" pairs from Set-Cookie headers, for sending back as a Cookie header. */
function cookiesFrom(response) {
  return Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";")[0].split(/=(.*)/s).slice(0, 2)));
}

async function call(method, path, { cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body) headers["content-type"] = "application/json";
  const response = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // redirects have no JSON body
  }
  return { status: response.status, body: json, location: response.headers.get("location"), response };
}

/** Runs the whole redirect dance. Returns the callback response and the session cookie, if any. */
async function signIn(claims, { code = "good-code", tamperState = false, nonce } = {}) {
  const start = await call("GET", "/auth/google?returnTo=/stations");
  assert.equal(start.status, 302);
  const googleUrl = new URL(start.location);
  const stateCookie = cookiesFrom(start.response).tbd_oauth;
  assert.ok(stateCookie, "state cookie set");

  nextClaims = {
    iss: "https://accounts.google.com", aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300,
    nonce: nonce ?? googleUrl.searchParams.get("nonce"), email_verified: true, ...claims,
  };
  const state = tamperState ? "someone-elses-state" : googleUrl.searchParams.get("state");
  const callback = await call("GET", `/auth/google/callback?code=${code}&state=${state}`, {
    cookie: `tbd_oauth=${stateCookie}`,
  });
  const session = cookiesFrom(callback.response).tbd_session;
  return { start, googleUrl, callback, cookie: session ? `tbd_session=${session}` : null };
}

test("signed out: data routes need a session; health, ingest and /auth/me stay open", { skip }, async () => {
  assert.equal((await call("GET", "/stations")).status, 401);
  assert.equal((await call("POST", "/stations", { body: { name: "X" } })).status, 401);
  assert.equal((await call("GET", "/health")).status, 200);
  const me = await call("GET", "/auth/me");
  assert.deepEqual(me.body, { authEnabled: true, user: null });
  const ingest = await call("POST", "/ingest", { body: { gateway: "GW-A", lines: [] } });
  assert.equal(ingest.status, 200);
});

test("the Google redirect carries PKCE, nonce, the hd hint and our callback URL", { skip }, async () => {
  const { googleUrl } = await signIn({ sub: "g-1", email: "first@g.rit.edu", hd: "g.rit.edu" });
  assert.equal(googleUrl.origin + googleUrl.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(googleUrl.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(googleUrl.searchParams.get("redirect_uri"), `${PUBLIC_URL}/api/auth/google/callback`);
  assert.equal(googleUrl.searchParams.get("hd"), "g.rit.edu");
  assert.equal(googleUrl.searchParams.get("code_challenge_method"), "S256");
  assert.ok(googleUrl.searchParams.get("nonce"));
  assert.ok(lastTokenRequest.code_verifier, "PKCE verifier sent to the token endpoint");
  assert.equal(lastTokenRequest.client_secret, "test-secret");
});

test("an RIT account signs in as a viewer: can read, cannot write", { skip }, async () => {
  const { callback, cookie } = await signIn({ sub: "g-viewer", email: "abc1234@g.rit.edu", hd: "g.rit.edu", name: "Abby" });
  assert.equal(callback.status, 302);
  assert.equal(callback.location, `${PUBLIC_URL}/stations`);
  assert.ok(cookie, "session cookie set");
  assert.match(callback.response.headers.getSetCookie().join("\n"), /tbd_session=.*HttpOnly.*SameSite=Lax/);

  const me = await call("GET", "/auth/me", { cookie });
  assert.equal(me.body.user.email, "abc1234@g.rit.edu");
  assert.equal(me.body.user.name, "Abby");
  assert.equal(me.body.user.role, "viewer");
  assert.equal((await call("GET", "/stations", { cookie })).status, 200);
  assert.equal((await call("POST", "/stations", { cookie, body: { name: "Nope" } })).status, 403);
  assert.equal((await call("GET", "/users", { cookie })).status, 403);
});

test("accounts outside the allowed domains get no session", { skip }, async () => {
  for (const claims of [
    { sub: "g-x1", email: "someone@gmail.com" },
    { sub: "g-x2", email: "abc1234@rit.edu" }, // personal Google account on an RIT address: no hd
    { sub: "g-x3", email: "abc5678@g.rit.edu", hd: "other.edu" },
  ]) {
    const { callback, cookie } = await signIn(claims);
    assert.equal(callback.location, `${PUBLIC_URL}/?auth_error=domain_not_allowed`, claims.email);
    assert.equal(cookie, null);
  }
  const unverified = await signIn({ sub: "g-x4", email: "abc9999@g.rit.edu", hd: "g.rit.edu", email_verified: false });
  assert.equal(unverified.callback.location, `${PUBLIC_URL}/?auth_error=email_not_verified`);
  const { rows } = await pool.query(
    "select count(*)::int as n from users where email = any($1)",
    [["someone@gmail.com", "abc1234@rit.edu", "abc9999@g.rit.edu"]],
  );
  assert.equal(rows[0].n, 0);
});

test("a forged state, a wrong nonce or a bad code are rejected", { skip }, async () => {
  const account = { sub: "g-y", email: "why@g.rit.edu", hd: "g.rit.edu" };
  assert.equal((await signIn(account, { tamperState: true })).callback.location, `${PUBLIC_URL}/?auth_error=expired`);
  assert.equal((await signIn(account, { nonce: "replayed" })).callback.location, `${PUBLIC_URL}/?auth_error=google_error`);
  assert.equal((await signIn(account, { code: "bad-code" })).callback.location, `${PUBLIC_URL}/?auth_error=google_error`);
  const noCookie = await call("GET", "/auth/google/callback?code=good-code&state=abc");
  assert.equal(noCookie.location, `${PUBLIC_URL}/?auth_error=expired`);
});

test("an admin email becomes admin and can promote a viewer to member", { skip }, async () => {
  const viewer = await signIn({ sub: "g-promote", email: "promote@g.rit.edu", hd: "g.rit.edu" });
  const boss = await signIn({ sub: "g-boss", email: "Boss@g.rit.edu", hd: "g.rit.edu" });
  assert.equal((await call("GET", "/auth/me", { cookie: boss.cookie })).body.user.role, "admin");

  const users = await call("GET", "/users", { cookie: boss.cookie });
  const target = users.body.find((user) => user.email === "promote@g.rit.edu");
  assert.equal(target.role, "viewer");
  assert.equal((await call("PATCH", `/users/${target.id}`, { cookie: boss.cookie, body: { role: "owner" } })).status, 400);
  assert.equal((await call("PATCH", `/users/${target.id}`, { cookie: boss.cookie, body: { role: "member" } })).status, 200);

  // The viewer's existing session picks up the new role straight away.
  const created = await call("POST", "/stations", { cookie: viewer.cookie, body: { name: "Promoted tree" } });
  assert.equal(created.status, 201);
});

test("a listed non-RIT address can sign in", { skip }, async () => {
  const { cookie } = await signIn({ sub: "g-teacher", email: "teacher@gmail.com" });
  assert.equal((await call("GET", "/auth/me", { cookie })).body.user.email, "teacher@gmail.com");
});

test("the same email from a different Google account is refused", { skip }, async () => {
  await signIn({ sub: "g-orig", email: "recycled@g.rit.edu", hd: "g.rit.edu" });
  const { callback, cookie } = await signIn({ sub: "g-imposter", email: "recycled@g.rit.edu", hd: "g.rit.edu" });
  assert.equal(callback.location, `${PUBLIC_URL}/?auth_error=account_mismatch`);
  assert.equal(cookie, null);
});

test("tampered, unknown and logged-out sessions are refused", { skip }, async () => {
  const { cookie } = await signIn({ sub: "g-out", email: "out@g.rit.edu", hd: "g.rit.edu" });
  const [name, value] = cookie.split("=");
  const token = decodeURIComponent(value);
  const tampered = `${name}=${encodeURIComponent(`${token[0] === "A" ? "B" : "A"}${token.slice(1)}`)}`;
  assert.equal((await call("GET", "/stations", { cookie: tampered })).status, 401);
  assert.equal((await call("GET", "/stations", { cookie: "tbd_session=made.up" })).status, 401);

  assert.equal((await call("GET", "/stations", { cookie })).status, 200);
  const logout = await call("POST", "/auth/logout", { cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.response.headers.getSetCookie()[0], /tbd_session=;.*Max-Age=0/);
  assert.equal((await call("GET", "/stations", { cookie })).status, 401);
});

test("expired sessions are refused", { skip }, async () => {
  const { cookie } = await signIn({ sub: "g-old", email: "old@g.rit.edu", hd: "g.rit.edu" });
  await pool.query(
    "update sessions set expires_at = now() - interval '1 minute' where user_id = (select id from users where email = 'old@g.rit.edu')",
  );
  assert.equal((await call("GET", "/stations", { cookie })).status, 401);
});
