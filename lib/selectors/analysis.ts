import type { Thresholds } from "@/lib/data/thresholds";
import { demoTimeline, type DemoDay } from "@/lib/demo/timeline";
import { demoWeather } from "@/lib/demo/weather";
import { liquidHoursBetween } from "@/lib/selectors/stations";
import type { SeasonSummary } from "@/lib/types/schema";

/** Number of tapped trees, for per-tree figures. */
export const TREE_COUNT = 5;

/**
 * A freeze-thaw cycle day: a hard freeze overnight and a thaw by midday, the
 * swing that drives sap. Prior seasons only kept one temperature per day, so
 * for them a day that reached 33°F stands in for "thawed after a freeze".
 */
export function cycleDays(season: SeasonSummary, isCurrent: boolean): boolean[] {
  if (isCurrent) {
    return season.weeklyFlow.map((_, index) => {
      const weather = demoWeather[index];
      return Boolean(weather && weather.lowF <= 28 && weather.highF >= 40);
    });
  }
  return season.weeklyFlow.map((point) => point.temp >= 33);
}

export function seasonStats(season: SeasonSummary, isCurrent: boolean) {
  const flow = season.weeklyFlow;
  const peak = flow.reduce<(typeof flow)[number] | null>(
    (best, point) => (best === null || point.lbs > best.lbs ? point : best),
    null,
  );
  const cycles = cycleDays(season, isCurrent);
  const cycleLbs = flow.filter((_, index) => cycles[index]).map((point) => point.lbs);
  const otherLbs = flow.filter((_, index) => !cycles[index]).map((point) => point.lbs);
  const total = flow.reduce((sum, point) => sum + point.lbs, 0);
  const avg = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  return {
    days: flow.length,
    peakLbs: peak?.lbs ?? 0,
    bestDay: peak?.week ?? "—",
    cycleDays: cycleLbs.length,
    avgCycleLbs: avg(cycleLbs),
    avgOtherLbs: avg(otherLbs),
    cycleShare: total ? cycleLbs.reduce((sum, value) => sum + value, 0) / total : 0,
  };
}

/** Season total per bucket so far, from each day's gain. */
export function bucketYields(day: DemoDay) {
  return day.buckets
    .map((bucket) => {
      const total = demoTimeline
        .slice(0, day.index + 1)
        .reduce(
          (sum, item) =>
            sum + (item.buckets.find((entry) => entry.bucketId === bucket.bucketId)?.gainedLbs ?? 0),
          0,
        );
      return {
        bucketId: bucket.bucketId,
        label: bucket.name.replace("Bucket ", ""),
        location: bucket.location,
        battery: bucket.batteryPercent,
        total: Math.round(total * 10) / 10,
        perDay: Math.round((total / (day.index + 1)) * 10) / 10,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Collections made after the sap passed its age limit, and by how much. */
export function overduePickups(day: DemoDay, thresholds: Thresholds) {
  const rows: { date: string; bucket: string; hoursOver: number }[] = [];
  const lastEmpty = new Map<number, number>();
  const chronological = [...day.collections].reverse();

  for (const collection of chronological) {
    const index = demoWeather.findIndex((item) => item.date === collection.date);
    for (const entry of collection.entries) {
      const since = lastEmpty.get(entry.bucketId) ?? 0;
      const hours = liquidHoursBetween(since, index, thresholds.warmSapAge.warn);
      if (hours > thresholds.sapAge.warn) {
        rows.push({
          date: collection.date,
          bucket: entry.bucketName.replace("Bucket ", ""),
          hoursOver: hours - thresholds.sapAge.warn,
        });
      }
      lastEmpty.set(entry.bucketId, index);
    }
  }
  return rows.reverse();
}
