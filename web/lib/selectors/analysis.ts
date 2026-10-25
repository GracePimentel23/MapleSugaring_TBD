import type { Thresholds } from "@/lib/data/thresholds";
import { sapSeasonOf, type LiveDay } from "@/lib/live/day";
import type { WeatherDay } from "@/lib/live/types";
import { liquidHours } from "@/lib/selectors/stations";
import { daysBetween } from "@/lib/time";
import type { SeasonSummary } from "@/lib/types/schema";

/** Number of tapped trees (stations still in use), for per-tree figures. */
export function treeCount(day: LiveDay): number {
  return Math.max(day.buckets.filter((bucket) => !bucket.retired).length, 1);
}

/**
 * A freeze-thaw cycle day: a hard freeze overnight and a thaw by midday, the
 * swing that drives sap. Prior seasons only kept one temperature per day, so
 * for them a day that reached 33°F stands in for "thawed after a freeze".
 */
export function cycleDays(season: SeasonSummary, isCurrent: boolean, weather: WeatherDay[] = []): boolean[] {
  return season.weeklyFlow.map((point) => {
    const forecast = isCurrent && point.date ? weather.find((item) => item.date === point.date) : undefined;
    if (forecast?.available) return forecast.lowF <= 28 && forecast.highF >= 40;
    return point.temp >= 33;
  });
}

export function seasonStats(season: SeasonSummary, isCurrent: boolean, weather: WeatherDay[] = []) {
  const flow = season.weeklyFlow;
  const peak = flow.reduce<(typeof flow)[number] | null>(
    (best, point) => (best === null || point.lbs > best.lbs ? point : best),
    null,
  );
  const cycles = cycleDays(season, isCurrent, weather);
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

/** Season total per bucket so far, from the collections logged this season. */
export function bucketYields(day: LiveDay) {
  const season = sapSeasonOf(day.date);
  const collections = day.collections.filter((collection) => collection.date <= day.date && sapSeasonOf(collection.date) === season);
  const first = collections.at(-1)?.date ?? day.date;
  const days = daysBetween(first, day.date) + 1;
  return day.buckets
    .filter((bucket) => !bucket.retired)
    .map((bucket) => {
      const total = collections.reduce(
        (sum, collection) =>
          sum + collection.entries.filter((entry) => entry.bucketId === bucket.bucketId).reduce((s, e) => s + e.lbs, 0),
        0,
      );
      return {
        bucketId: bucket.bucketId,
        label: bucket.name.replace("Bucket ", ""),
        location: bucket.location,
        battery: bucket.batteryPercent,
        total: Math.round(total * 10) / 10,
        perDay: Math.round((total / days) * 10) / 10,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Collections made after the sap passed its age limit, and by how much. */
export function overduePickups(day: LiveDay, weather: WeatherDay[], thresholds: Thresholds) {
  const rows: { date: string; bucket: string; hoursOver: number }[] = [];
  const lastEmpty = new Map<number, string>();
  const chronological = [...day.collections].reverse();

  for (const collection of chronological) {
    for (const entry of collection.entries) {
      const since = lastEmpty.get(entry.bucketId);
      // The first pickup of a bucket has nothing to measure from.
      const hours = since ? liquidHours(since, collection.date, weather, thresholds.warmSapAge.warn) : 0;
      if (hours > thresholds.sapAge.warn) {
        rows.push({
          date: collection.date,
          bucket: entry.bucketName.replace("Bucket ", ""),
          hoursOver: hours - thresholds.sapAge.warn,
        });
      }
      lastEmpty.set(entry.bucketId, collection.date);
    }
  }
  return rows.reverse();
}
