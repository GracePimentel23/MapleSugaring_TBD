import type { AuditEntry } from "@/components/session/SessionProvider";
import type { LiveDay } from "@/lib/live/day";
import { getResolvedHistory } from "@/lib/selectors/alerts";
import { daysBetween, shortDate } from "@/lib/time";

export interface ActivityItem {
  key: string;
  text: string;
  /** ISO date of the day it happened */
  date: string;
  /** "9:40 AM", or "" when only the day is known */
  time: string;
  /** For sorting: ms since epoch (noon for day-only items) */
  sortAt: number;
}

const ZONE = "America/New_York";
const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(iso));
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit" });

/** Things in the audit log already told by their own line below. */
const COVERED = new Set(["Logged collection", "Started batch"]);

/**
 * The latest happenings at the sugarbush: collections, batches, alerts clearing, and changes made
 * in the app (from the audit log, for roles that can read it).
 */
export function getRecentActivity(day: LiveDay, audit: AuditEntry[], limit = 4): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const collection of day.collections.slice(0, 20)) {
    const buckets = collection.entries.map((entry) => entry.bucketName.replace("Bucket ", "")).join(" and ");
    items.push({
      key: `collection-${collection.id}`,
      text: `${collection.loggedBy || "Someone"} logged ${collection.totalLbs} lbs from ${buckets}`,
      date: collection.date,
      time: "",
      sortAt: new Date(`${collection.date}T12:00:00Z`).getTime(),
    });
  }

  for (const batch of day.batches.slice(0, 20)) {
    const text =
      batch.status === "processing"
        ? `${batch.batchNumber} is boiling`
        : batch.status === "completed"
          ? `${batch.batchNumber} closed · ${batch.syrupOutLbs} lbs syrup`
          : `${batch.batchNumber} opened`;
    items.push({
      key: `batch-${batch.id}`,
      text,
      date: batch.date,
      time: "",
      sortAt: new Date(`${batch.date}T12:00:00Z`).getTime(),
    });
  }

  for (const resolved of getResolvedHistory(day)) {
    if (resolved.bucketLabel === "All") continue;
    items.push({
      key: `resolved-${resolved.key}`,
      text: `${resolved.bucketLabel} ${resolved.label} alert resolved`,
      date: dayOf(resolved.resolvedAt),
      time: timeOf(resolved.resolvedAt),
      sortAt: new Date(resolved.resolvedAt).getTime(),
    });
  }

  for (const entry of audit.slice(0, 50)) {
    if (COVERED.has(entry.action)) continue;
    items.push({
      key: `audit-${entry.id}`,
      text: `${entry.user}: ${entry.action.toLowerCase()} · ${entry.record}`,
      date: dayOf(entry.at),
      time: timeOf(entry.at),
      sortAt: new Date(entry.at).getTime(),
    });
  }

  return items.sort((a, b) => b.sortAt - a.sortAt).slice(0, limit);
}

/** "Today, 9:40 AM" / "Yesterday" / "3/9, 10:15 AM" */
export function activityWhen(item: ActivityItem, today: string): string {
  const ago = daysBetween(item.date, today);
  const label = ago === 0 ? "Today" : ago === 1 ? "Yesterday" : shortDate(item.date);
  return item.time ? `${label}, ${item.time}` : label;
}
