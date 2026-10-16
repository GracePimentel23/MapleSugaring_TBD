import type { AuditEntry } from "@/components/session/SessionProvider";
import type { Thresholds } from "@/lib/data/thresholds";
import { demoBatchSpecs } from "@/lib/demo/script";
import { demoTimeline } from "@/lib/demo/timeline";
import { getResolvedHistory } from "@/lib/selectors/alerts";
import { hoursOfDay, shortDate } from "@/lib/time";

export interface ActivityItem {
  key: string;
  text: string;
  dayIndex: number;
  /** "9:40 AM" */
  time: string;
}

function dayIndexOf(short: string): number {
  return demoTimeline.findIndex((day) => shortDate(day.date) === short);
}

/**
 * The latest happenings at the sugarbush: collections, batches opening and
 * boiling, alerts clearing, and anything done in the app this session.
 */
export function getRecentActivity(
  dayIndex: number,
  audit: AuditEntry[],
  thresholds: Thresholds,
  limit = 4,
): ActivityItem[] {
  const today = demoTimeline[dayIndex]!;
  const items: ActivityItem[] = [];

  for (const collection of today.collections) {
    const index = demoTimeline.findIndex((day) => day.date === collection.date);
    const buckets = collection.entries.map((entry) => entry.bucketName.replace("Bucket ", "")).join(" and ");
    items.push({
      key: `collection-${collection.id}`,
      text: `${collection.loggedBy} logged ${collection.totalLbs} lbs from Bucket ${buckets}`,
      dayIndex: index,
      time: "8:10 AM",
    });
  }

  for (const spec of demoBatchSpecs) {
    for (const stage of spec.stages) {
      if (stage.fromDay > dayIndex) continue;
      const text =
        stage.status === "processing"
          ? `${spec.createdBy} started boiling ${spec.batchNumber}`
          : stage.status === "completed"
            ? `${spec.batchNumber} closed · ${stage.syrupOutLbs} lbs syrup`
            : stage.fromDay === spec.fromDay
              ? `${spec.batchNumber} opened`
              : `${spec.batchNumber} updated`;
      items.push({
        key: `batch-${spec.batchNumber}-${stage.fromDay}`,
        text,
        dayIndex: stage.fromDay,
        time: stage.status === "processing" ? "10:15 AM" : stage.status === "completed" ? "4:00 PM" : "8:00 AM",
      });
    }
  }

  for (const resolved of getResolvedHistory(dayIndex, thresholds)) {
    if (resolved.bucketLabel === "All") continue;
    items.push({
      key: `resolved-${resolved.key}`,
      text: `Bucket ${resolved.bucketLabel} ${resolved.label} alert resolved`,
      dayIndex: resolved.dayIndex,
      time: resolved.when.split(", ")[1] ?? "9:30 AM",
    });
  }

  for (const entry of audit) {
    const [date, time = "12:00 PM"] = entry.when.split(", ");
    const index = dayIndexOf(date ?? "");
    if (index < 0 || index > dayIndex) continue;
    const text =
      entry.action === "Logged collection"
        ? `${entry.user} logged ${entry.change} from ${entry.record.split(",")[0]}`
        : `${entry.user}: ${entry.action.toLowerCase()} · ${entry.record}`;
    items.push({ key: `audit-${entry.id}`, text, dayIndex: index, time });
  }

  return items
    .sort((a, b) => b.dayIndex - a.dayIndex || hoursOfDay(b.time) - hoursOfDay(a.time))
    .slice(0, limit);
}

/** "Today, 9:40 AM" / "Yesterday, 4:20 PM" / "3/9, 10:15 AM" */
export function activityWhen(item: ActivityItem, dayIndex: number): string {
  if (item.dayIndex === dayIndex) return `Today, ${item.time}`;
  if (item.dayIndex === dayIndex - 1) return `Yesterday, ${item.time}`;
  return `${shortDate(demoTimeline[item.dayIndex]!.date)}, ${item.time}`;
}
