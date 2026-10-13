import type { Thresholds } from "@/lib/data/thresholds";
import { demoTimeline } from "@/lib/demo/timeline";
import { getStationCards, getWeatherAlerts } from "@/lib/selectors/stations";
import { shortDate } from "@/lib/time";
import type { ClubAlert } from "@/lib/types/schema";

export interface ResolvedAlert {
  key: string;
  dayIndex: number;
  /** "3/10, 4:20 PM" */
  when: string;
  label: string;
  kind: ClubAlert["kind"];
  bucketLabel: string;
  resolvedBy: string;
}

const noOverrides = {
  maintenance: new Set<number>(),
  notes: {},
  treeEdits: {},
  loggedToday: new Set<number>(),
};

function alertsOn(dayIndex: number, thresholds: Thresholds): ClubAlert[] {
  const day = demoTimeline[dayIndex]!;
  return [
    ...getWeatherAlerts(day, thresholds),
    ...getStationCards(day, noOverrides, thresholds).flatMap((station) => station.alerts),
  ];
}

/**
 * Alerts that cleared during the last `days` days of the replay. An alert that
 * was live yesterday and is gone today was resolved today: by whoever logged
 * the collection that emptied the bucket, otherwise automatically.
 */
export function getResolvedHistory(
  dayIndex: number,
  thresholds: Thresholds,
  days = 7,
): ResolvedAlert[] {
  const history: ResolvedAlert[] = [];

  for (let index = Math.max(1, dayIndex - days + 1); index <= dayIndex; index += 1) {
    const day = demoTimeline[index]!;
    const before = alertsOn(index - 1, thresholds);
    const now = new Set(alertsOn(index, thresholds).map((alert) => alert.key));
    const collection = day.collections.find((item) => item.date === day.date);
    const silent = new Set(
      day.buckets.filter((bucket) => bucket.nodeStatus === "offline").map((bucket) => bucket.bucketId),
    );

    for (const alert of before) {
      if (now.has(alert.key)) continue;
      // Emptying a bucket clears fill and sap-age alerts, nothing else.
      const emptiedAlert = alert.kind === "due" || alert.kind === "full" || alert.kind === "sapAge";
      const collected =
        emptiedAlert &&
        collection &&
        collection.entries.some((entry) => entry.bucketId === alert.bucketId);
      // A sensor that went silent hides its other alerts; that alone is not a fix.
      if (!collected && alert.kind !== "offline" && alert.bucketId !== null && silent.has(alert.bucketId)) {
        continue;
      }
      history.push({
        key: `${alert.key}@${index}`,
        dayIndex: index,
        when: `${shortDate(day.date)}, ${collected ? "8:10 AM" : "9:30 AM"}`,
        label: alert.label,
        kind: alert.kind,
        bucketLabel: alert.bucketLabel,
        resolvedBy: collected ? collection.loggedBy : "Auto",
      });
    }
  }

  return history.reverse();
}
