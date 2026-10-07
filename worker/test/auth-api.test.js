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

test("signed out is the guest view: dashboard and stations only; health, ingest and /auth/me stay open", { skip }, async () => {
  assert.equal((await call("GET", "/dashboard")).status, 200);
  assert.equal((await call("GET", "/stations")).status, 200);
  for (const path of ["/collections", "/batches", "/alerts", "/readings", "/users"]) {
    assert.equal((await call("GET", path)).status, 401, path);
  }
  assert.equal((await call("POST", "/stations", { body: { name: "X" } })).status, 401);
  assert.equal((await call("POST", "/collections", { body: { bucketIds: [1] } })).status, 401);
  assert.equal((await call("GET", "/health")).status, 200);
  const me = await call("GET", "/auth/me", { cookie: "tbd_view_as=owner" }); // ignored: sign-in is on
  assert.equal(me.body.authEnabled, true);
  assert.equal(me.body.viewAs, null);
  assert.equal(me.body.user, null);
  assert.equal(me.body.role, "guest");
  assert.deepEqual(me.body.permissions, ["dashboard:view", "stations:view", "demo:use"]);
  assert.equal(me.body.components["dashboard.sapChart"], true);
  assert.equal(me.body.components["nav.data"], false);
  assert.equal(me.body.components["data.collections.add"], false);
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

test("an RIT account signs in as a member: reads everything, cannot run the season", { skip }, async () => {
  const { callback, cookie } = await signIn({ sub: "g-member", email: "abc1234@g.rit.edu", hd: "g.rit.edu", name: "Abby" });
  assert.equal(callback.status, 302);
  assert.equal(callback.location, `${PUBLIC_URL}/stations`);
  assert.ok(cookie, "session cookie set");
  assert.match(callback.response.headers.getSetCookie().join("\n"), /tbd_session=.*HttpOnly.*SameSite=Lax/);

  const me = await call("GET", "/auth/me", { cookie });
  assert.equal(me.body.user.email, "abc1234@g.rit.edu");
  assert.equal(me.body.user.name, "Abby");
  assert.equal(me.body.user.role, "member");
  assert.equal(me.body.role, "member");
  assert.equal(me.body.components["nav.data"], true);
  assert.equal(me.body.components["data.collections.add"], true);
  assert.equal(me.body.components["data.batches.manage"], false);
  assert.equal(me.body.components["nav.settings"], false);
  assert.equal((await call("GET", "/stations", { cookie })).status, 200);
  assert.equal((await call("GET", "/collections", { cookie })).status, 200);
  const refused = await call("POST", "/stations", { cookie, body: { name: "Nope" } });
  assert.equal(refused.status, 403);
  assert.match(refused.body.error, /needs stations:manage/);
  assert.equal((await call("POST", "/batches", { cookie, body: {} })).status, 403);
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

test("an ADMIN_EMAILS address becomes owner and can promote a member to manager", { skip }, async () => {
  const member = await signIn({ sub: "g-promote", email: "promote@g.rit.edu", hd: "g.rit.edu" });
  const boss = await signIn({ sub: "g-boss", email: "Boss@g.rit.edu", hd: "g.rit.edu" });
  const bossMe = await call("GET", "/auth/me", { cookie: boss.cookie });
  assert.equal(bossMe.body.user.role, "owner");
  assert.equal(bossMe.body.components["nav.settings"], true);

  const roles = await call("GET", "/roles", { cookie: boss.cookie });
  assert.deepEqual(roles.body.map((role) => [role.name, role.assignable]), [
    ["guest", false], ["member", true], ["manager", true], ["owner", true],
  ]);

  const users = await call("GET", "/users", { cookie: boss.cookie });
  const target = users.body.find((user) => user.email === "promote@g.rit.edu");
  assert.equal(target.role, "member");
  for (const role of ["admin", "guest"]) {
    assert.equal((await call("PATCH", `/users/${target.id}`, { cookie: boss.cookie, body: { role } })).status, 400, role);
  }

  // As a member: logs collections, cannot add stations or delete collections.
  const station = await call("POST", "/stations", { cookie: boss.cookie, body: { name: "Owner tree" } });
  assert.equal(station.status, 201);
  const logged = await call("POST", "/collections", { cookie: member.cookie, body: { bucketIds: [station.body.bucketId] } });
  assert.equal(logged.status, 201);
  assert.equal((await call("POST", "/stations", { cookie: member.cookie, body: { name: "Nope" } })).status, 403);
  assert.equal((await call("DELETE", `/collections/${logged.body.id}`, { cookie: member.cookie })).status, 403);

  const promoted = await call("PATCH", `/users/${target.id}`, { cookie: boss.cookie, body: { role: "manager" } });
  assert.equal(promoted.status, 200);
  assert.deepEqual(promoted.body, { ok: true, changed: true, user: { id: target.id, email: "promote@g.rit.edu", role: "manager" } });

  // The existing session picks up the new role straight away; people stay with owners.
  assert.equal((await call("DELETE", `/collections/${logged.body.id}`, { cookie: member.cookie })).status, 200);
  assert.equal((await call("POST", "/stations", { cookie: member.cookie, body: { name: "Manager tree" } })).status, 201);
  assert.equal((await call("GET", "/users", { cookie: member.cookie })).status, 403);

  // The change is in the audit log, with who made it.
  const audit = await call("GET", `/audit?entity=user&id=${target.id}`, { cookie: boss.cookie });
  assert.equal(audit.status, 200);
  assert.equal(audit.body.length, 1);
  assert.equal(audit.body[0].action, "role_change");
  assert.equal(audit.body[0].actor_email, "boss@g.rit.edu");
  assert.deepEqual([audit.body[0].before, audit.body[0].after], [{ role: "member" }, { role: "manager" }]);
  assert.equal((await call("GET", "/audit", { cookie: member.cookie })).status, 403);
});

test("the last owner cannot be demoted, and ADMIN_EMAILS cannot be demoted at all", { skip }, async () => {
  const boss = await signIn({ sub: "g-boss", email: "boss@g.rit.edu", hd: "g.rit.edu" });
  const second = await signIn({ sub: "g-second", email: "second@g.rit.edu", hd: "g.rit.edu" });
  const users = (await call("GET", "/users", { cookie: boss.cookie })).body;
  const bossId = users.find((user) => user.email === "boss@g.rit.edu").id;
  const secondId = users.find((user) => user.email === "second@g.rit.edu").id;

  const keepBoss = await call("PATCH", `/users/${bossId}`, { cookie: boss.cookie, body: { role: "member" } });
  assert.equal(keepBoss.status, 409);
  assert.match(keepBoss.body.error, /ADMIN_EMAILS/);

  assert.equal((await call("PATCH", `/users/${secondId}`, { cookie: boss.cookie, body: { role: "owner" } })).status, 200);
  // Take boss out by hand (the API refuses, see above), leaving second as the only owner.
  await pool.query("update users set role_id = (select id from roles where role_name = 'manager') where id = $1", [bossId]);
  const last = await call("PATCH", `/users/${secondId}`, { cookie: second.cookie, body: { role: "manager" } });
  assert.equal(last.status, 409);
  assert.match(last.body.error, /last owner/);
  assert.equal((await call("GET", "/auth/me", { cookie: second.cookie })).body.role, "owner");

  // Signing in again restores an ADMIN_EMAILS address to owner, and that is audited too.
  await signIn({ sub: "g-boss", email: "boss@g.rit.edu", hd: "g.rit.edu" });
  const audit = (await call("GET", `/audit?entity=user&id=${bossId}`, { cookie: second.cookie })).body;
  assert.equal(audit[0].reason, "listed in ADMIN_EMAILS");
  assert.deepEqual([audit[0].before, audit[0].after], [{ role: "manager" }, { role: "owner" }]);
  assert.equal((await call("PATCH", `/users/${secondId}`, { cookie: second.cookie, body: { role: "member" } })).status, 200);
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
  assert.equal((await call("GET", "/collections", { cookie: tampered })).status, 401);
  assert.equal((await call("GET", "/collections", { cookie: "tbd_session=made.up" })).status, 401);

  assert.equal((await call("GET", "/collections", { cookie })).status, 200);
  const logout = await call("POST", "/auth/logout", { cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.response.headers.getSetCookie()[0], /tbd_session=;.*Max-Age=0/);
  assert.equal((await call("GET", "/collections", { cookie })).status, 401);
});

test("expired sessions are refused", { skip }, async () => {
  const { cookie } = await signIn({ sub: "g-old", email: "old@g.rit.edu", hd: "g.rit.edu" });
  await pool.query(
    "update sessions set expires_at = now() - interval '1 minute' where user_id = (select id from users where email = 'old@g.rit.edu')",
  );
  assert.equal((await call("GET", "/collections", { cookie })).status, 401);
});

test("the roles table holds exactly the configured roles", { skip }, async () => {
  const { rows } = await pool.query("select role_name from roles order by role_name");
  assert.deepEqual(rows.map((row) => row.role_name), ["manager", "member", "owner"]);
});
