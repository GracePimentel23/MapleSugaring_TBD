/**
 * Writes to audit_log, which Settings > Audit Log reads: who changed what, with a readable record
 * ("Bucket #02") and change ("12 lbs to 14 lbs") next to the raw before/after.
 */
import { optionalText } from "./http.js";

/**
 * Who did it, for the log and for "acknowledged by": the signed-in user, or with sign-in off the
 * name the browser sends as `by` (the "View as" account, only used for display).
 */
export function actorName(req) {
  return req.user?.name ?? optionalText(req.body?.by, "by", 100);
}

export async function audit(db, req, { entity, entityId, action, record, change = null, before = null, after = null }) {
  await db.query(
    `insert into audit_log (actor_id, actor_email, actor_name, entity, entity_id, action, before, after, record, change)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [req.user?.id ?? null, req.user?.email ?? null, actorName(req), entity, entityId === undefined ? null : String(entityId),
      action, before, after, record ?? null, change],
  );
}

/** "Sap in: 12 to 14 lbs; Brix: 66° to 67°", from [label, before, after, unit] rows that changed. */
export function describeChanges(rows) {
  return rows
    .filter(([, before, after]) => after !== null && after !== undefined && String(before ?? "") !== String(after))
    .map(([label, before, after, unit = ""]) => `${label}: ${before ?? "—"}${unit} to ${after}${unit}`)
    .join("; ");
}
