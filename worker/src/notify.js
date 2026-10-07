/**
 * Email for urgent alerts (today: bucket tipped), sent through Resend (https://resend.com, free tier).
 * Off until RESEND_API_KEY and ALERT_EMAIL_TO are set. Without a verified domain, Resend's test
 * sender (onboarding@resend.dev) can only mail the address the Resend account was made with.
 */
import { config } from "./config.js";

let lastError = null;

/** Why the last email failed (e.g. Resend only mails its own address without a verified domain). */
export function lastEmailError() {
  return lastError;
}

export function emailConfigured() {
  return Boolean(config.email.apiKey && config.email.to.length);
}

/** Returns true if Resend accepted the email. Never throws: a failed email must not fail ingest. */
export async function sendEmail({ subject, text }) {
  if (!emailConfigured()) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.email.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: config.email.from, to: config.email.to, subject, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const body = await response.text();
      let detail = body.slice(0, 300);
      try {
        detail = JSON.parse(body).message ?? detail;
      } catch {
        // not JSON: keep the raw text
      }
      lastError = detail;
      console.error(`alert email refused: ${response.status} ${detail}`);
      return false;
    }
    lastError = null;
    return true;
  } catch (error) {
    lastError = error.message;
    console.error(`alert email failed: ${error.message}`);
    return false;
  }
}

/** alert: the new alerts row plus { station, lostLbs, nowLbs }. */
export function sendAlertEmail(alert) {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timeZone, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(alert.created_at ?? Date.now()));
  const link = config.siteUrl;
  return sendEmail({
    subject: `Bucket tipped: ${alert.station}`,
    text: [
      `${alert.station} may have tipped over at ${when}.`,
      `It lost ${alert.lostLbs} lbs at once and now reads ${alert.nowLbs} lbs.`,
      "",
      link ? `Stations: ${link}/stations` : null,
      "Turn on collection mode before emptying a bucket so this alert does not fire.",
    ].filter((line) => line !== null).join("\n"),
  });
}
