import type { LiveDay } from "@/lib/live/day";
import type { ApiAlert } from "@/lib/live/types";
import type { ClubAlert } from "@/lib/types/schema";

export interface ResolvedAlert {
  key: string;
  /** ISO timestamp it was resolved */
  resolvedAt: string;
  /** "3/10, 4:20 PM" */
  when: string;
  label: string;
  kind: ClubAlert["kind"];
  bucketLabel: string;
  resolvedBy: string;
}

/** The worker's alert types, as the Alerts page names them. */
export const alertTypeMeta: Record<string, { kind: ClubAlert["kind"]; label: string }> = {
  station_offline: { kind: "offline", label: "No signal" },
  bucket_full: { kind: "full", label: "Full" },
  bucket_tipped: { kind: "tipped", label: "Knocked over" },
  sensor_missing: { kind: "sensor", label: "Sensor fault" },
  out_of_range: { kind: "sensor", label: "Sensor fault" },
};

/** "3/10, 4:20 PM" in the club's time zone */
export function alertStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "#02" for the alert's bucket, or "All" */
export function alertBucketLabel(day: LiveDay, alert: ApiAlert): string {
  const bucket = day.buckets.find(
    (item) => item.bucketId === alert.bucket_id || (alert.node_id !== null && item.nodeId === alert.node_id),
  );
  return bucket ? bucket.name.replace("Bucket ", "") : "All";
}

/**
 * Alerts the worker marked resolved in the last `days` days: by whoever resolved them in the app,
 * by a collection that emptied the bucket, or automatically when the sensor came back ("Auto").
 */
export function getResolvedHistory(day: LiveDay, days = 7): ResolvedAlert[] {
  const cutoff = Date.now() - days * 86_400_000;
  return day.alerts
    .filter((alert) => alert.is_resolved && alert.resolved_at && new Date(alert.resolved_at).getTime() >= cutoff)
    .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""))
    .map((alert) => {
      const meta = alertTypeMeta[alert.alert_type] ?? { kind: "sensor" as const, label: alert.alert_type };
      return {
        key: `api-${alert.id}`,
        resolvedAt: alert.resolved_at!,
        when: alertStamp(alert.resolved_at!),
        label: meta.label,
        kind: meta.kind,
        bucketLabel: alertBucketLabel(day, alert),
        resolvedBy: alert.resolved_by ?? "Auto",
      };
    });
}
