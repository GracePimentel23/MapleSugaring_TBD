import { defaultPosition } from "@/lib/live/place";
import type { ApiAlert, ApiStation, LiveData, WeatherDay } from "@/lib/live/types";
import { flowRating } from "@/lib/selectors/season";
import { monthDay, weekdayName } from "@/lib/time";
import type { Batch, Collection, DashboardMeta, SeasonSummary, WeeklyCollectionPoint } from "@/lib/types/schema";

/**
 * Turns the API's answers into the `day` every screen reads: today's buckets, alerts, collections,
 * batches, weather and season totals. It has the same shape the design-changes demo replayed from
 * its scripted timeline, so the screens did not have to change much to show live data.
 */

export interface LiveBucketState {
  bucketId: number;
  nodeId: number;
  name: string;
  /** Where it is, e.g. "North Grove, tree 2"; "No location set" until someone adds one */
  location: string;
  treeSpecies: string;
  treeLabel: string;
  /** The LoRa node id, e.g. "LC01" */
  sensorId: string;
  lat: number;
  lon: number;
  hasPosition: boolean;
  fillLbs: number;
  capacityLbs: number;
  fillPercent: number;
  nodeStatus: "online" | "offline";
  batteryPercent: number | null;
  sapFlowLph: number;
  /** "9:30 AM" today, "Oct 12, 9:30 AM" before that, or "—" before the first reading */
  lastUpdated: string;
  /** ISO time of the last reading, or null */
  updatedAt: string | null;
  trend: number[];
  mode: ApiStation["mode"];
  modeUntil: string | null;
  retired: boolean;
  /** Date of the last collection that emptied it, or null */
  lastCollectedOn: string | null;
}

export interface DailyTotal {
  date: string;
  /** "Tue" */
  weekday: string;
  /** "Mar 1" */
  axisLabel: string;
  lbs: number;
  temperatureF: number;
}

export interface LiveDay {
  /** Position of today in the weather window */
  index: number;
  date: string;
  weather: WeatherDay;
  meta: DashboardMeta;
  buckets: LiveBucketState[];
  /** The worker's alerts: open ones, and those resolved in the last 7 days */
  alerts: ApiAlert[];
  /** Newest first */
  collections: Collection[];
  /** Newest first */
  batches: Batch[];
  /** Sap collected per day this season, oldest first, today last */
  dailyTotals: DailyTotal[];
  weeklyCollection: WeeklyCollectionPoint[];
  /** This season first, then older ones */
  seasons: SeasonSummary[];
}

/** A season is named for the year it ends in: July onward counts toward next year's. */
export function sapSeasonOf(isoDate: string): number {
  const [year, month] = isoDate.split("-").map(Number) as [number, number];
  return month >= 7 ? year + 1 : year;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function emptySeason(year: number): SeasonSummary {
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

/** One line on how today's weather should make sap run, for the dashboard. */
function sapCondition(weather: WeatherDay): DashboardMeta["sapCondition"] {
  if (!weather.available) {
    return { label: "Sap Condition", headline: "No forecast right now", flow: "unknown" };
  }
  const rating = flowRating(weather.lowF, weather.highF);
  if (rating === "good") {
    return { label: "Sap Condition", headline: "A freezing night and a thaw by midday push sap", flow: "strong" };
  }
  if (rating === "fair") {
    return { label: "Sap Condition", headline: "A small freeze-thaw swing, expect a modest run", flow: "moderate" };
  }
  if (weather.highF < 32) {
    return { label: "Sap Condition", headline: "Too cold all day for sap to run", flow: "none" };
  }
  return { label: "Sap Condition", headline: "No overnight freeze, so the trees are not pushing sap", flow: "slow" };
}

/** "9:30 AM" if it was today, else "Oct 12, 9:30 AM", in the club's time zone. */
function readingTime(iso: string | null, today: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const zone = "America/New_York";
  const time = date.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(date);
  return day === today ? time : `${date.toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric" })}, ${time}`;
}

function bucketState(station: ApiStation, collections: Collection[], today: string): LiveBucketState {
  const position = station.lat !== null && station.lon !== null ? { lat: station.lat, lon: station.lon } : null;
  const last = collections.find((collection) => collection.entries.some((entry) => entry.bucketId === station.bucketId));
  return {
    bucketId: station.bucketId,
    nodeId: station.nodeId ?? 0,
    name: station.name,
    location: station.location ?? "No location set",
    treeSpecies: station.treeSpecies,
    treeLabel: station.location ?? "No location set",
    sensorId: station.nodeCode ?? "—",
    ...(position ?? defaultPosition(station.bucketId)),
    hasPosition: position !== null,
    fillLbs: station.currentLbs,
    capacityLbs: station.capacityLbs,
    fillPercent: station.fillPercent,
    nodeStatus: station.status === "offline" ? "offline" : "online",
    batteryPercent: station.batteryLevel,
    sapFlowLph: station.sapFlowLph,
    lastUpdated: readingTime(station.updatedAt, today),
    updatedAt: station.updatedAt,
    trend: station.trend,
    mode: station.mode,
    modeUntil: station.modeUntil,
    retired: station.retired,
    lastCollectedOn: last?.date ?? null,
  };
}

export function buildDay(data: LiveData): LiveDay {
  const { today, weather: window } = data;
  const index = Math.max(window.findIndex((item) => item.date === today), 0);
  const weather = window[index]!;
  const weatherOn = new Map(window.map((item) => [item.date, item]));
  const avgTemp = (iso: string) => {
    const item = weatherOn.get(iso);
    return item?.available ? Math.round((item.highF + item.lowF) / 2) : 0;
  };

  const year = sapSeasonOf(today);
  const seasonName = `Season ${year}`;
  const inSeason = data.collections.filter((collection) => sapSeasonOf(collection.date) === year);

  const byDay = new Map<string, number>();
  for (const collection of inSeason) byDay.set(collection.date, (byDay.get(collection.date) ?? 0) + collection.totalLbs);
  if (!byDay.has(today)) byDay.set(today, 0);
  const dailyTotals: DailyTotal[] = [...byDay.keys()]
    .filter((iso) => iso <= today)
    .sort()
    .map((iso) => ({
      date: iso,
      weekday: weekdayName(iso, "short"),
      axisLabel: monthDay(iso),
      lbs: round1(byDay.get(iso) ?? 0),
      temperatureF: avgTemp(iso),
    }));

  // The API's seasons, newest first, with this season always at the top (even before any data).
  const seasons = [...data.seasons].sort((a, b) => b.season.localeCompare(a.season));
  if (!seasons.some((season) => season.season === seasonName)) seasons.unshift(emptySeason(year));
  // The load cells may not report temperature; fill this season's days in from the forecast.
  const withWeather = seasons.map((season) => {
    if (season.season !== seasonName) return season;
    const weeklyFlow = season.weeklyFlow.map((point) =>
      point.date && !point.temp && avgTemp(point.date) ? { ...point, temp: avgTemp(point.date) } : point,
    );
    const temps = weeklyFlow.map((point) => point.temp).filter((temp) => temp !== 0);
    const avgTempF =
      season.avgTempF || (temps.length ? Math.round(temps.reduce((sum, temp) => sum + temp, 0) / temps.length) : 0);
    return { ...season, weeklyFlow, avgTempF };
  });

  const production = data.dashboard?.production ?? {
    periodLabel: "This season",
    sapCollectedLbs: round1(inSeason.reduce((sum, collection) => sum + collection.totalLbs, 0)),
    sapProcessedLbs: 0,
    syrupProducedLbs: 0,
  };

  const meta: DashboardMeta = {
    seasonLabel: data.dashboard?.seasonLabel ?? seasonName,
    currentDate: today,
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
    sapCondition: sapCondition(weather),
    weatherAlert: null,
    production,
  };

  return {
    index,
    date: today,
    weather,
    meta,
    buckets: data.stations.map((station) => bucketState(station, data.collections, today)),
    alerts: data.alerts,
    collections: data.collections,
    batches: data.batches,
    dailyTotals,
    weeklyCollection: data.dashboard?.weeklyCollection ?? [],
    seasons: withWeather,
  };
}
