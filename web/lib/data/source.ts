import "server-only";

import { fetchWorker } from "@/lib/api/server";
import { alerts as mockAlerts, buckets, dashboardMeta, nodes } from "@/lib/data/mock";
import { batches as mockBatches, collections as mockCollections, seasons as mockSeasons } from "@/lib/data/records";
import { getDashboardView } from "@/lib/selectors/dashboard";
import { getStationSummary } from "@/lib/selectors/stations";
import type {
  Alert,
  Batch,
  Collection,
  DashboardMeta,
  SeasonSummary,
  StationView,
  WeeklyCollectionPoint,
} from "@/lib/types/schema";
import { formatLbs } from "@/lib/units";

/**
 * One place that decides where page data comes from: the worker API when WORKER_URL is set and
 * reachable ("live"), otherwise the bundled sample data ("sample") so the UI always renders.
 */
export type DataSource = "live" | "sample";

const TIME_ZONE = "America/New_York";

interface StationsResponse {
  stations: StationView[];
  alerts: Alert[];
  onlineCount: number;
  alertCount: number;
  summaryLabel: string;
}

interface DashboardResponse {
  seasonLabel: string;
  currentDate: string;
  production: DashboardMeta["production"];
  weeklyCollection: WeeklyCollectionPoint[];
}

function dateLabels(now = new Date()) {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, ...options }).format(now);
  return {
    currentDateLabel: format({ weekday: "long", month: "long", day: "numeric" }),
    currentDateShortLabel: format({ weekday: "short", month: "short", day: "numeric" }),
  };
}

export async function loadStations() {
  const live = await fetchWorker<StationsResponse>("/stations");
  if (live) return { ...live, source: "live" as DataSource };
  return { ...getStationSummary(), alerts: mockAlerts, source: "sample" as DataSource };
}

export async function loadShell() {
  const [dashboard, stations] = await Promise.all([
    fetchWorker<DashboardResponse>("/dashboard"),
    fetchWorker<StationsResponse>("/stations"),
  ]);
  if (!dashboard || !stations) {
    return {
      seasonLabel: dashboardMeta.seasonLabel,
      currentDateLabel: dashboardMeta.currentDateLabel,
      currentDateShortLabel: dashboardMeta.currentDateShortLabel,
      hasUnreadAlerts: mockAlerts.some((alert) => !alert.is_resolved) || Boolean(dashboardMeta.weatherAlert),
      source: "sample" as DataSource,
    };
  }
  return {
    seasonLabel: dashboard.seasonLabel,
    ...dateLabels(),
    hasUnreadAlerts: stations.alertCount > 0,
    source: "live" as DataSource,
  };
}

export async function loadDashboard() {
  const [dashboard, stations] = await Promise.all([
    fetchWorker<DashboardResponse>("/dashboard"),
    fetchWorker<StationsResponse>("/stations"),
  ]);
  if (!dashboard || !stations) {
    return { ...getDashboardView(), source: "sample" as DataSource };
  }

  // Weather and sap-condition cards have no data source yet, so they keep the sample values.
  const meta: DashboardMeta = {
    ...dashboardMeta,
    seasonLabel: dashboard.seasonLabel,
    currentDate: dashboard.currentDate,
    ...dateLabels(),
    production: dashboard.production,
  };
  return {
    meta,
    weeklyCollection: dashboard.weeklyCollection,
    production: {
      periodLabel: dashboard.production.periodLabel,
      items: [
        { label: "Sap Collected", value: formatLbs(dashboard.production.sapCollectedLbs) },
        { label: "Sap Processed", value: formatLbs(dashboard.production.sapProcessedLbs) },
        { label: "Syrup Produced", value: formatLbs(dashboard.production.syrupProducedLbs) },
      ],
    },
    stations: stations.stations,
    onlineCount: stations.onlineCount,
    alertCount: stations.alertCount,
    summaryLabel: stations.summaryLabel,
    hasUnreadAlerts: stations.alertCount > 0,
    source: "live" as DataSource,
  };
}

export interface BucketOption {
  bucketId: number;
  name: string;
}

export interface RecordsData {
  collections: Collection[];
  batches: Batch[];
  seasons: SeasonSummary[];
  bucketOptions: BucketOption[];
  recordsDate: string;
  source: DataSource;
}

/** A zeroed season so the Overview and Analysis tabs render before anything has been collected. */
function emptySeason(): SeasonSummary {
  const now = new Date();
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return {
    season: `Season ${year}`,
    totalSapLbs: 0,
    totalSyrupLbs: 0,
    avgBrix: 0,
    sapToSyrupRatio: 0,
    totalCollections: 0,
    totalBatches: 0,
    avgTempF: 0,
    weeklyFlow: [],
  };
}

export async function loadRecords(): Promise<RecordsData> {
  const [collections, batches, seasons, stations] = await Promise.all([
    fetchWorker<Collection[]>("/collections"),
    fetchWorker<Batch[]>("/batches"),
    fetchWorker<SeasonSummary[]>("/seasons"),
    fetchWorker<StationsResponse>("/stations"),
  ]);
  if (collections && batches && seasons && stations) {
    return {
      collections,
      batches,
      seasons: seasons.length ? seasons : [emptySeason()],
      bucketOptions: stations.stations.map((station) => ({ bucketId: station.bucketId, name: station.name })),
      recordsDate: new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date()),
      source: "live",
    };
  }
  return {
    collections: mockCollections,
    batches: mockBatches,
    seasons: mockSeasons,
    bucketOptions: buckets.map((bucket) => ({
      bucketId: bucket.id,
      name: nodes.find((node) => node.id === bucket.node_id)?.node_code ?? `Bucket #${bucket.id}`,
    })),
    recordsDate: "2022-03-14",
    source: "sample",
  };
}
