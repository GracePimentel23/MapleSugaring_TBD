import type {
  Alert,
  Batch,
  Collection,
  CollectionEntry,
  DashboardMeta,
  SeasonSummary,
  WeeklyCollectionPoint,
} from "@/lib/types/schema";
import {
  bucketProfiles,
  CAPACITY_LBS,
  COLD_BATTERY_PENALTY,
  COLD_NIGHT_THRESHOLD_F,
  LOW_BATTERY_THRESHOLD,
  OFFLINE_REPORT_TIME,
} from "@/lib/demo/profiles";
import { demoBatchSpecs, demoScript, type DemoNarration } from "@/lib/demo/script";
import { demoWeather, SEASON_LABEL, type DemoWeatherDay } from "@/lib/demo/weather";
import { lbsToLiters } from "@/lib/units";

export interface DemoBucketState {
  bucketId: number;
  nodeId: number;
  name: string;
  location: string;
  treeSpecies: string;
  fillLbs: number;
  capacityLbs: number;
  fillPercent: number;
  nodeStatus: "online" | "offline";
  batteryPercent: number;
  sapFlowLph: number;
  lastUpdated: string;
  /** Sap added today, after capping at capacity */
  gainedLbs: number;
  isFull: boolean;
  /** Fill history up to and including today, so the sparkline grows */
  trend: number[];
}

export interface DemoDailyTotal {
  date: string;
  /** "Tue" */
  weekday: string;
  /** "Mar 1" */
  axisLabel: string;
  lbs: number;
  temperatureF: number;
}

export interface DemoDay {
  index: number;
  dayNumber: number;
  totalDays: number;
  date: string;
  weather: DemoWeatherDay;
  meta: DashboardMeta;
  buckets: DemoBucketState[];
  alerts: Alert[];
  collections: Collection[];
  batches: Batch[];
  dailyTotals: DemoDailyTotal[];
  weeklyCollection: WeeklyCollectionPoint[];
  seasons: SeasonSummary[];
  narration: DemoNarration;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** "Tue, Mar 1" -> "Tue" */
function weekdayOf(day: DemoWeatherDay): string {
  return day.shortLabel.split(",")[0] ?? "";
}

/** "Tue, Mar 1" -> "Mar 1" */
function axisLabelOf(day: DemoWeatherDay): string {
  return (day.shortLabel.split(", ")[1] ?? day.shortLabel).trim();
}

/**
 * Prior seasons, for the Overview and Analysis comparison views. Same Mar 1-14
 * span as the demo window so the two series line up index for index.
 */
const priorSeasons: SeasonSummary[] = [
  {
    season: "Season 2021",
    totalSapLbs: 109.8,
    totalSyrupLbs: 4.3,
    avgBrix: 66.1,
    sapToSyrupRatio: 25.5,
    totalCollections: 9,
    totalBatches: 7,
    avgTempF: 31,
    weeklyFlow: [
      { week: "Mar 1", lbs: 6, temp: 28 },
      { week: "Mar 2", lbs: 8.5, temp: 31 },
      { week: "Mar 3", lbs: 11.2, temp: 34 },
      { week: "Mar 4", lbs: 4, temp: 26 },
      { week: "Mar 5", lbs: 2.2, temp: 24 },
      { week: "Mar 6", lbs: 9.8, temp: 33 },
      { week: "Mar 7", lbs: 14.1, temp: 37 },
      { week: "Mar 8", lbs: 12.6, temp: 36 },
      { week: "Mar 9", lbs: 3.4, temp: 27 },
      { week: "Mar 10", lbs: 1.8, temp: 25 },
      { week: "Mar 11", lbs: 10.2, temp: 34 },
      { week: "Mar 12", lbs: 13.5, temp: 38 },
      { week: "Mar 13", lbs: 7.1, temp: 30 },
      { week: "Mar 14", lbs: 5.4, temp: 29 },
    ],
  },
  {
    season: "Season 2020",
    totalSapLbs: 115.5,
    totalSyrupLbs: 4.6,
    avgBrix: 65.9,
    sapToSyrupRatio: 25.1,
    totalCollections: 8,
    totalBatches: 6,
    avgTempF: 31,
    weeklyFlow: [
      { week: "Mar 1", lbs: 4.2, temp: 26 },
      { week: "Mar 2", lbs: 7.1, temp: 29 },
      { week: "Mar 3", lbs: 9.4, temp: 32 },
      { week: "Mar 4", lbs: 12.8, temp: 35 },
      { week: "Mar 5", lbs: 6.3, temp: 30 },
      { week: "Mar 6", lbs: 2.9, temp: 25 },
      { week: "Mar 7", lbs: 8.7, temp: 31 },
      { week: "Mar 8", lbs: 11.5, temp: 34 },
      { week: "Mar 9", lbs: 13.2, temp: 36 },
      { week: "Mar 10", lbs: 5.8, temp: 29 },
      { week: "Mar 11", lbs: 3.1, temp: 26 },
      { week: "Mar 12", lbs: 9.9, temp: 33 },
      { week: "Mar 13", lbs: 12.4, temp: 35 },
      { week: "Mar 14", lbs: 8.2, temp: 31 },
    ],
  },
];

function buildTimeline(): DemoDay[] {
  const fills = new Map<number, number>();
  const histories = new Map<number, number[]>();
  const batteries = new Map<number, number>();

  for (const profile of bucketProfiles) {
    fills.set(profile.bucketId, 0);
    histories.set(profile.bucketId, []);
    batteries.set(profile.bucketId, profile.startBatteryPercent);
  }

  const collections: Collection[] = [];
  const dailyTotals: DemoDailyTotal[] = [];
  const days: DemoDay[] = [];

  let cumulativeSapLbs = 0;
  let alertId = 1;

  for (let index = 0; index < demoWeather.length; index += 1) {
    const weather = demoWeather[index]!;
    const script = demoScript[index]!;

    // Batteries drain overnight, faster after a hard freeze.
    if (index > 0) {
      const previous = demoWeather[index - 1]!;
      const coldExtra =
        previous.lowF <= COLD_NIGHT_THRESHOLD_F ? COLD_BATTERY_PENALTY : 0;

      for (const profile of bucketProfiles) {
        const current = batteries.get(profile.bucketId) ?? 0;
        batteries.set(
          profile.bucketId,
          Math.max(0, current - profile.batteryDrainPerDay - coldExtra),
        );
      }
    }

    // Collections are applied before today's yield, so a bucket that was full
    // yesterday reads near-empty today.
    const clearedWhileFull: number[] = [];

    if (script.collection) {
      const entries: CollectionEntry[] = [];

      for (const bucketId of script.collection.bucketIds) {
        const profile = bucketProfiles.find((item) => item.bucketId === bucketId);
        if (!profile) continue;

        const lbs = round1(fills.get(bucketId) ?? 0);
        if (lbs >= CAPACITY_LBS) clearedWhileFull.push(bucketId);

        entries.push({
          bucketId,
          bucketName: profile.name,
          collectedBy:
            script.collection.collectedBy[bucketId] ?? script.collection.loggedBy,
          lbs,
        });

        fills.set(bucketId, 0);
      }

      const collectionNumber = collections.length + 1;
      collections.unshift({
        id: `c${collectionNumber}`,
        collectionNumber,
        date: weather.date,
        entries,
        totalLbs: round1(entries.reduce((sum, entry) => sum + entry.lbs, 0)),
        batchName: `Batch #${String(collectionNumber).padStart(2, "0")}`,
        loggedBy: script.collection.loggedBy,
        notes: script.collection.notes,
      });
    }

    const offlineBuckets = new Set(script.offlineBucketIds ?? []);
    let dayTotalLbs = 0;

    const buckets: DemoBucketState[] = bucketProfiles.map((profile) => {
      const isOffline = offlineBuckets.has(profile.bucketId);
      const before = fills.get(profile.bucketId) ?? 0;
      const raw = isOffline ? 0 : script.baseYieldLbs * profile.yieldFactor;
      const uncapped = before + raw;
      const after = Math.min(CAPACITY_LBS, uncapped);
      const gained = after - before;

      fills.set(profile.bucketId, after);
      dayTotalLbs += gained;

      const fillLbs = round1(after);
      const history = histories.get(profile.bucketId) ?? [];
      history.push(fillLbs);

      const batteryPercent = round1(batteries.get(profile.bucketId) ?? 0);

      return {
        bucketId: profile.bucketId,
        nodeId: profile.nodeId,
        name: profile.name,
        location: profile.location,
        treeSpecies: profile.treeSpecies,
        fillLbs,
        capacityLbs: CAPACITY_LBS,
        fillPercent: round1((after / CAPACITY_LBS) * 100),
        nodeStatus: isOffline ? "offline" : "online",
        batteryPercent,
        // Sap flow expressed over a four-hour afternoon run window.
        sapFlowLph: round1(lbsToLiters(gained) / 4),
        lastUpdated: isOffline ? OFFLINE_REPORT_TIME : profile.reportTime,
        gainedLbs: round1(gained),
        isFull: uncapped >= CAPACITY_LBS,
        trend: [...history],
      };
    });

    cumulativeSapLbs += dayTotalLbs;

    dailyTotals.push({
      date: weather.date,
      weekday: weekdayOf(weather),
      axisLabel: axisLabelOf(weather),
      lbs: round1(dayTotalLbs),
      temperatureF: weather.temperatureF,
    });

    // ── Alerts for today ────────────────────────────────────
    const alerts: Alert[] = [];

    for (const bucket of buckets) {
      if (bucket.nodeStatus === "offline") {
        alerts.push({
          id: alertId,
          node_id: bucket.nodeId,
          alert_type: "node_offline",
          severity: "critical",
          message: `${bucket.name} stopped reporting - moved indoors ahead of the snow`,
          is_resolved: false,
          created_at: `${weather.date}T06:02:00-05:00`,
        });
        alertId += 1;
        continue;
      }

      if (bucket.isFull) {
        alerts.push({
          id: alertId,
          node_id: bucket.nodeId,
          alert_type: "high_fill",
          severity: "warning",
          message: `${bucket.name} at capacity (${bucket.fillLbs.toFixed(1)} lbs)`,
          is_resolved: false,
          created_at: `${weather.date}T14:20:00-05:00`,
        });
        alertId += 1;
      }

      if (bucket.batteryPercent < LOW_BATTERY_THRESHOLD) {
        alerts.push({
          id: alertId,
          node_id: bucket.nodeId,
          alert_type: "low_battery",
          severity: "warning",
          message: `${bucket.name} battery at ${Math.round(bucket.batteryPercent)}% - replace before the next run`,
          is_resolved: false,
          created_at: `${weather.date}T07:45:00-05:00`,
        });
        alertId += 1;
      }
    }

    // A bucket that was full and got emptied today shows its alert resolved.
    for (const bucketId of clearedWhileFull) {
      const profile = bucketProfiles.find((item) => item.bucketId === bucketId);
      if (!profile) continue;

      alerts.push({
        id: alertId,
        node_id: profile.nodeId,
        alert_type: "high_fill",
        severity: "warning",
        message: `${profile.name} emptied - capacity alert cleared`,
        is_resolved: true,
        created_at: `${weather.date}T08:10:00-05:00`,
      });
      alertId += 1;
    }

    // ── Batches visible today ───────────────────────────────
    const batches: Batch[] = demoBatchSpecs
      .filter((spec) => index >= spec.fromDay)
      .map((spec, specIndex) => {
        const stage =
          [...spec.stages].reverse().find((item) => index >= item.fromDay) ??
          spec.stages[0]!;
        const source = collections.find(
          (collection) => collection.batchName === spec.batchNumber,
        );

        return {
          id: `b${specIndex + 1}`,
          batchNumber: spec.batchNumber,
          date: demoWeather[spec.fromDay]!.date,
          status: stage.status,
          sapInLbs: source?.totalLbs ?? 0,
          syrupOutLbs: stage.syrupOutLbs,
          brix: stage.brix,
          createdBy: spec.createdBy,
          notes: stage.notes,
        };
      })
      .reverse();

    const completedBatches = batches.filter((batch) => batch.status === "completed");
    const processedBatches = batches.filter(
      (batch) => batch.status === "completed" || batch.status === "processing",
    );

    const syrupProducedLbs = completedBatches.reduce(
      (sum, batch) => sum + batch.syrupOutLbs,
      0,
    );
    const sapProcessedLbs = processedBatches.reduce(
      (sum, batch) => sum + batch.sapInLbs,
      0,
    );
    const avgBrix = completedBatches.length
      ? completedBatches.reduce((sum, batch) => sum + batch.brix, 0) /
        completedBatches.length
      : 0;

    const meta: DashboardMeta = {
      seasonLabel: SEASON_LABEL,
      currentDate: weather.date,
      currentDateLabel: weather.label,
      currentDateShortLabel: weather.shortLabel,
      weather: {
        label: "Today's Condition",
        temperatureF: weather.temperatureF,
        lowF: weather.lowF,
        highF: weather.highF,
        summary: weather.summary,
        precipIn: weather.precipIn,
        snowIn: weather.snowIn,
        windMph: weather.windMph,
        cloudPercent: weather.cloudPercent,
      },
      sapCondition: {
        label: "Sap Condition",
        headline: script.sapHeadline,
        flow: script.flowLabel,
      },
      weatherAlert: script.weatherAlert ? { message: script.weatherAlert } : null,
      production: {
        periodLabel: "Mar 1 - Today",
        sapCollectedLbs: round1(cumulativeSapLbs),
        sapProcessedLbs: round1(sapProcessedLbs),
        syrupProducedLbs: round1(syrupProducedLbs),
      },
    };

    const recent = dailyTotals.slice(-7);
    const weeklyCollection: WeeklyCollectionPoint[] = recent.map((entry, position) => ({
      day: position === recent.length - 1 ? "Today" : entry.weekday,
      lbs: entry.lbs,
    }));

    const avgTempF = Math.round(
      dailyTotals.reduce((sum, entry) => sum + entry.temperatureF, 0) /
        dailyTotals.length,
    );

    const currentSeason: SeasonSummary = {
      season: SEASON_LABEL,
      totalSapLbs: round1(cumulativeSapLbs),
      totalSyrupLbs: round1(syrupProducedLbs),
      avgBrix: round1(avgBrix),
      sapToSyrupRatio:
        syrupProducedLbs > 0 ? round1(sapProcessedLbs / syrupProducedLbs) : 0,
      totalCollections: collections.length,
      totalBatches: batches.length,
      avgTempF,
      weeklyFlow: dailyTotals.map((entry) => ({
        week: entry.axisLabel,
        lbs: entry.lbs,
        temp: entry.temperatureF,
      })),
    };

    days.push({
      index,
      dayNumber: index + 1,
      totalDays: demoWeather.length,
      date: weather.date,
      weather,
      meta,
      buckets,
      alerts,
      collections: collections.map((collection) => ({
        ...collection,
        entries: [...collection.entries],
      })),
      batches,
      dailyTotals: dailyTotals.map((entry) => ({ ...entry })),
      weeklyCollection,
      seasons: [currentSeason, ...priorSeasons],
      narration: script.narration,
    });
  }

  return days;
}

export const demoTimeline: DemoDay[] = buildTimeline();

export const DEMO_TOTAL_DAYS = demoTimeline.length;

export function getDemoDay(index: number): DemoDay {
  const clamped = Math.min(Math.max(index, 0), demoTimeline.length - 1);
  return demoTimeline[clamped]!;
}
