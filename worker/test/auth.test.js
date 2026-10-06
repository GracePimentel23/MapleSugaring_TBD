/** Sign-in rules that don't need a database: who may sign in, token checks, cookie signing. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkAccount,
  decodeJwtPayload,
  parseCookies,
  previewRole,
  safeReturnTo,
  serializeCookie,
  sign,
  unsign,
  validateIdClaims,
} from "../src/auth.js";

const policy = {
  allowedDomains: ["g.rit.edu", "rit.edu"],
  allowedEmails: ["teacher@gmail.com"],
  adminEmails: ["boss@g.rit.edu"],
};
const claims = (extra) => ({ sub: "123", email_verified: true, name: "Sam Student", ...extra });

test("an RIT Workspace account is allowed", () => {
  const result = checkAccount(claims({ email: "abc1234@g.rit.edu", hd: "g.rit.edu" }), policy);
  assert.equal(result.ok, true);
  assert.equal(result.email, "abc1234@g.rit.edu");
  assert.equal(result.admin, false);
});

test("email is compared case-insensitively", () => {
  const result = checkAccount(claims({ email: "ABC1234@G.RIT.EDU", hd: "g.rit.edu" }), policy);
  assert.equal(result.ok, true);
  assert.equal(result.email, "abc1234@g.rit.edu");
});

test("a personal Google account using an RIT address (no hd claim) is refused", () => {
  assert.deepEqual(checkAccount(claims({ email: "abc1234@rit.edu" }), policy), { ok: false, reason: "domain_not_allowed" });
  assert.equal(checkAccount(claims({ email: "abc1234@g.rit.edu" }), policy).ok, false);
});

test("hd from another organization is refused even with an allowed-looking email", () => {
  assert.equal(checkAccount(claims({ email: "abc1234@g.rit.edu", hd: "evil.example" }), policy).ok, false);
});

test("other domains are refused", () => {
  assert.equal(checkAccount(claims({ email: "someone@gmail.com" }), policy).reason, "domain_not_allowed");
  assert.equal(checkAccount(claims({ email: "x@notrit.edu", hd: "notrit.edu" }), policy).ok, false);
  assert.equal(checkAccount(claims({ email: "x@sub.g.rit.edu", hd: "sub.g.rit.edu" }), policy).ok, false);
});

test("unverified email is refused, even for listed addresses", () => {
  assert.equal(
    checkAccount(claims({ email: "abc1234@g.rit.edu", hd: "g.rit.edu", email_verified: false }), policy).reason,
    "email_not_verified",
  );
  assert.equal(checkAccount(claims({ email: "boss@g.rit.edu", email_verified: undefined }), policy).ok, false);
});

test("listed and admin addresses are allowed whatever their domain", () => {
  assert.equal(checkAccount(claims({ email: "teacher@gmail.com" }), policy).ok, true);
  const admin = checkAccount(claims({ email: "boss@g.rit.edu" }), policy);
  assert.equal(admin.ok, true);
  assert.equal(admin.admin, true);
});

test("no allowed domains means only listed addresses get in", () => {
  const strict = { allowedDomains: [], allowedEmails: [], adminEmails: ["boss@g.rit.edu"] };
  assert.equal(checkAccount(claims({ email: "abc1234@g.rit.edu", hd: "g.rit.edu" }), strict).ok, false);
  assert.equal(checkAccount(claims({ email: "boss@g.rit.edu", hd: "g.rit.edu" }), strict).ok, true);
});

test("id token claims: issuer, audience, expiry, nonce", () => {
  const good = { iss: "https://accounts.google.com", aud: "client-1", exp: Date.now() / 1000 + 300, nonce: "n1", sub: "1" };
  const opts = { clientId: "client-1", nonce: "n1" };
  assert.equal(validateIdClaims(good, opts), null);
  assert.equal(validateIdClaims({ ...good, iss: "accounts.google.com" }, opts), null);
  assert.equal(validateIdClaims({ ...good, iss: "https://evil.example" }, opts), "bad_issuer");
  assert.equal(validateIdClaims({ ...good, aud: "someone-else" }, opts), "bad_audience");
  assert.equal(validateIdClaims({ ...good, exp: Date.now() / 1000 - 3600 }, opts), "expired");
  assert.equal(validateIdClaims({ ...good, nonce: "other" }, opts), "bad_nonce");
  assert.equal(validateIdClaims(good, { clientId: "client-1", nonce: "" }), "bad_nonce");
});

test("jwt payload decoding", () => {
  const payload = Buffer.from(JSON.stringify({ sub: "9" })).toString("base64url");
  assert.deepEqual(decodeJwtPayload(`e30.${payload}.sig`), { sub: "9" });
  assert.throws(() => decodeJwtPayload("not-a-jwt"));
});

test("signed cookie values reject tampering and the wrong secret", () => {
  const secret = "s".repeat(32);
  const signed = sign("token-abc", secret);
  assert.equal(unsign(signed, secret), "token-abc");
  assert.equal(unsign(signed.replace("token-abc", "token-abd"), secret), null);
  assert.equal(unsign(`${signed}x`, secret), null);
  assert.equal(unsign(signed, "t".repeat(32)), null);
  assert.equal(unsign("no-signature", secret), null);
  assert.equal(unsign(undefined, secret), null);
});

test("cookies parse and serialize as httpOnly, SameSite=Lax", () => {
  assert.deepEqual(parseCookies("a=1; tbd_session=x.y%3D; b"), { a: "1", tbd_session: "x.y=" });
  assert.deepEqual(parseCookies(undefined), {});
  const cookie = serializeCookie("tbd_session", "v", { maxAge: 60, secure: true });
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=60/);
  assert.doesNotMatch(serializeCookie("x", "v"), /Secure/);
});

test("return paths stay on this site", () => {
  assert.equal(safeReturnTo("/stations?x=1"), "/stations?x=1");
  assert.equal(safeReturnTo("https://evil.example"), "/");
  assert.equal(safeReturnTo("//evil.example"), "/");
  assert.equal(safeReturnTo("/\\evil.example"), "/");
  assert.equal(safeReturnTo("/api/auth/logout"), "/");
  assert.equal(safeReturnTo(undefined), "/");
});

test("View as: the cookie picks a role only while sign-in is off", () => {
  const req = (cookie) => ({ get: () => cookie });
  assert.equal(previewRole(req("tbd_view_as=manager"), { authEnabled: false, devRole: null }), "manager");
  assert.equal(previewRole(req("tbd_view_as=guest"), { authEnabled: false, devRole: "owner" }), "guest");
  assert.equal(previewRole(req("tbd_view_as=all"), { authEnabled: false, devRole: "guest" }), null);
  assert.equal(previewRole(req("tbd_view_as=root"), { authEnabled: false, devRole: "member" }), "member");
  assert.equal(previewRole(req(undefined), { authEnabled: false, devRole: null }), null);
  assert.equal(previewRole(req("tbd_view_as=owner"), { authEnabled: true, devRole: null }), null);
  // A public Vercel deployment ignores the cookie: DEV_ROLE (guest by default there) applies.
  assert.equal(previewRole(req("tbd_view_as=all"), { authEnabled: false, devRole: "guest", onVercel: true }), "guest");
});
