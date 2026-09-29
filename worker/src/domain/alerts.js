/** One open alert per dedupe key: re-raising an open condition is a no-op. */
export async function openAlert(db, { nodeId, bucketId, key, type, severity, message }) {
  await db.query(
    `insert into alerts (node_id, bucket_id, alert_type, severity, message, dedupe_key)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (dedupe_key) where is_resolved = false do nothing`,
    [nodeId, bucketId, type, severity, message, key],
  );
}

export async function resolveAlerts(db, keys) {
  if (!keys.length) return;
  await db.query(
    `update alerts set is_resolved = true, resolved_at = now()
      where is_resolved = false and dedupe_key = any($1)`,
    [keys],
  );
}
