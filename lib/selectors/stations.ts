import type { Thresholds } from "@/lib/data/thresholds";
import { demoWeather } from "@/lib/demo/weather";
import type { DemoBucketState, DemoDay } from "@/lib/demo/timeline";
import type {
  ClubAlert,
  StationNote,
  StationStatus,
  StationView,
} from "@/lib/types/schema";

/** Edits made from Settings > Trees & Sensors. */
export interface TreeEdit {
  treeLabel?: string;
  treeSpecies?: string;
  sensorId?: string;
}

/** Client-side state layered on top of the timeline. */
export interface StationOverrides {
  maintenance: ReadonlySet<number>;
  notes: Record<number, StationNote[]>;
  treeEdits: Record<number, TreeEdit>;
  /** Buckets emptied by a collection logged in the app on this demo day */
  loggedToday: ReadonlySet<number>;
}

/** Sap only ages while it is liquid: the afternoon thaw. Frozen sap keeps. */
const THAW_HIGH_F = 40;
const THAW_HOURS = 8;
const WARM_THAW_HOURS = 12;

function dayIndexOf(isoDate: string): number {
  return demoWeather.findIndex((day) => day.date === isoDate);
}

/**
 * Hours the sap now in the bucket has sat thawed. Each thaw afternoon since the
 * last collection adds hours; a warm day adds more; a frozen day adds none.
 */
function sapAgeHours(day: DemoDay, bucketId: number, warmHighF: number): number {
  const lastCollection = day.collections.find((collection) =>
    collection.entries.some((entry) => entry.bucketId === bucketId),
  );
  const start = lastCollection ? dayIndexOf(lastCollection.date) : 0;
  return liquidHoursBetween(Math.max(start, 0), day.index, warmHighF);
}

/** Thawed hours from the afternoon of `startIndex` up to (not including) `endIndex`. */
export function liquidHoursBetween(startIndex: number, endIndex: number, warmHighF: number): number {
  let hours = 0;
  for (let index = startIndex; index < endIndex; index += 1) {
    const high = demoWeather[index]?.highF ?? 0;
    if (high > warmHighF) hours += WARM_THAW_HOURS;
    else if (high >= THAW_HIGH_F) hours += THAW_HOURS;
  }
  return hours;
}

function shortName(name: string): string {
  return name.replace("Bucket ", "");
}

function bucketAlerts(
  day: DemoDay,
  bucket: DemoBucketState,
  station: { name: string; location: string; fillPercent: number; batteryLevel: number; sapAgeHours: number; lastUpdated: string },
  thresholds: Thresholds,
  emptiedToday: boolean,
): ClubAlert[] {
  const alerts: ClubAlert[] = [];
  const { name, location, lastUpdated } = station;
  const base = { bucketId: bucket.bucketId, bucketLabel: shortName(name) };

  if (bucket.nodeStatus === "offline") {
    alerts.push({
      ...base,
      key: `offline-${bucket.bucketId}`,
      kind: "offline",
      severity: "critical",
      title: `${name} has no signal`,
      advice: `${location}. No reading since ${lastUpdated}. Check the sensor.`,
      context: `${location} · since ${lastUpdated}. The sensor stopped reporting.`,
      label: "No signal",
    });
    // A silent sensor has no fresh weight or battery reading to judge.
    return alerts;
  }

  const battery = Math.round(station.batteryLevel);
  if (battery < thresholds.battery.warn) {
    alerts.push({
      ...base,
      key: `battery-${bucket.bucketId}`,
      kind: "battery",
      severity: battery < thresholds.battery.critical ? "critical" : "warn",
      title: `${name} battery is at ${battery}%`,
      advice: `${location}. Replace it soon or the sensor will go offline.`,
      context: `${location} · since ${lastUpdated}. Replace it soon or the sensor will go offline.`,
      label: "Low battery",
    });
  }

  if (emptiedToday) return alerts;

  const fill = Math.round(station.fillPercent);
  if (fill >= thresholds.fill.critical) {
    alerts.push({
      ...base,
      key: `full-${bucket.bucketId}`,
      kind: "full",
      severity: "critical",
      title: `${name} is full`,
      advice: `${location}. Empty it now or sap will overflow.`,
      context: `${location} · since ${lastUpdated}. At ${fill}% of the target weight.`,
      label: "Full",
    });
  } else if (fill >= thresholds.fill.warn) {
    alerts.push({
      ...base,
      key: `due-${bucket.bucketId}`,
      kind: "due",
      severity: "warn",
      title: `${name} is ${fill}% full`,
      advice: `${location}. Collect it soon.`,
      context: `${location} · since ${lastUpdated}. Past the ${thresholds.fill.warn}% fill mark.`,
      label: "Due",
    });
  }

  const warm = day.weather.highF > thresholds.warmSapAge.warn;
  const limit = warm ? thresholds.warmSapAge.critical : thresholds.sapAge.warn;
  const age = station.sapAgeHours;
  if (age >= limit && fill > 5) {
    alerts.push({
      ...base,
      key: `sapAge-${bucket.bucketId}`,
      kind: "sapAge",
      severity: warm || age >= thresholds.sapAge.critical ? "critical" : "warn",
      title: `${name} sap has waited ${age} hours`,
      advice: warm
        ? `${location}. Collect today; warm weather speeds up spoilage.`
        : `${location}. Collect it soon so the sap stays fresh.`,
      context: `${location} · since ${lastUpdated}. Past the ${limit}-hour limit.`,
      label: "Due",
    });
  }

  return alerts;
}

function statusFor(
  alerts: ClubAlert[],
  isOffline: boolean,
  inMaintenance: boolean,
): StationStatus {
  if (inMaintenance) return "maintenance";
  if (isOffline) return "offline";
  if (alerts.some((alert) => alert.kind === "full")) return "full";
  if (alerts.some((alert) => alert.kind === "battery")) return "lowBattery";
  if (alerts.some((alert) => alert.kind === "due" || alert.kind === "sapAge")) return "due";
  return "filling";
}

export function getStationCards(
  day: DemoDay,
  overrides: StationOverrides,
  thresholds: Thresholds,
): StationView[] {
  return day.buckets.map((bucket) => {
    const edit = overrides.treeEdits[bucket.bucketId] ?? {};
    const isOffline = bucket.nodeStatus === "offline";
    const inMaintenance = overrides.maintenance.has(bucket.bucketId);
    const loggedToday = overrides.loggedToday.has(bucket.bucketId);

    const currentLbs = loggedToday ? 0 : bucket.fillLbs;
    const fillPercent = loggedToday ? 0 : bucket.fillPercent;
    const sapAge = loggedToday ? 0 : sapAgeHours(day, bucket.bucketId, thresholds.warmSapAge.warn);

    const facts = {
      name: bucket.name,
      location: bucket.location,
      fillPercent,
      batteryLevel: bucket.batteryPercent,
      sapAgeHours: sapAge,
      lastUpdated: bucket.lastUpdated,
    };
    const live = bucketAlerts(day, bucket, facts, thresholds, loggedToday);

    return {
      bucketId: bucket.bucketId,
      nodeId: bucket.nodeId,
      name: bucket.name,
      shortName: shortName(bucket.name),
      location: bucket.location,
      treeLabel: edit.treeLabel ?? bucket.treeLabel,
      sensorId: edit.sensorId ?? bucket.sensorId,
      treeSpecies: edit.treeSpecies ?? bucket.treeSpecies,
      lat: bucket.lat,
      lon: bucket.lon,
      status: statusFor(live, isOffline, inMaintenance),
      isOffline,
      inMaintenance,
      // Maintenance pauses alerts for the bucket while its sensor is serviced.
      alerts: inMaintenance ? [] : live,
      notes: overrides.notes[bucket.bucketId] ?? [],
      lastUpdated: bucket.lastUpdated,
      currentLbs,
      capacityLbs: bucket.capacityLbs,
      fillPercent,
      batteryLevel: bucket.batteryPercent,
      sapFlowLph: bucket.sapFlowLph,
      sapAgeHours: sapAge,
      loggedToday,
      trend: loggedToday ? [...bucket.trend.slice(0, -1), 0] : bucket.trend,
    };
  });
}

/** Grove-wide weather alerts for the day. */
export function getWeatherAlerts(day: DemoDay, thresholds: Thresholds): ClubAlert[] {
  const base = { bucketId: null, bucketLabel: "All", key: `weather-${day.date}`, kind: "weather" as const };
  const { highF, lowF } = day.weather;

  if (day.meta.weatherAlert) {
    return [
      {
        ...base,
        severity: "warn",
        title: day.meta.weatherAlert.message.replace(/^Weather Alert:\s*/, ""),
        advice: `Rochester. ${day.meta.sapCondition.headline}.`,
        context: `Rochester · today. High ${highF}°F, low ${lowF}°F.`,
        label: highF > thresholds.heat.warn ? "Heat event" : "Weather",
      },
    ];
  }
  if (lowF < thresholds.hardFreeze.warn) {
    return [
      {
        ...base,
        severity: lowF < thresholds.hardFreeze.critical ? "critical" : "warn",
        title: `Hard freeze forecast: low of ${lowF}°F`,
        advice: "Rochester. Check that buckets and lines are not cracking.",
        context: `Rochester · tonight. Below ${thresholds.hardFreeze.warn}°F.`,
        label: "Hard freeze forecast",
      },
    ];
  }
  if (highF > thresholds.heat.warn) {
    return [
      {
        ...base,
        severity: highF > thresholds.heat.critical ? "critical" : "warn",
        title: `Heat event: high of ${highF}°F`,
        advice: "Rochester. Sap spoils faster; collect everything today.",
        context: `Rochester · today. Above ${thresholds.heat.warn}°F.`,
        label: "Heat event",
      },
    ];
  }
  return [];
}

export function getStationSummary(stations: StationView[]) {
  const onlineCount = stations.filter((station) => !station.isOffline).length;
  const attentionCount = stations.filter(needsAttention).length;
  return { onlineCount, attentionCount };
}

export function needsAttention(station: StationView): boolean {
  return station.status !== "filling" && station.status !== "maintenance";
}

/** Filter pills on the Stations page. */
export type StationFilter = "all" | "filling" | "due" | "problems" | "maintenance";

export function matchesFilter(station: StationView, filter: StationFilter): boolean {
  if (filter === "all") return true;
  if (filter === "filling") return station.status === "filling";
  if (filter === "due") return station.status === "due" || station.status === "full";
  if (filter === "problems") return station.status === "lowBattery" || station.status === "offline";
  return station.status === "maintenance";
}

/** Most urgent first, then bucket order. */
const statusRank: Record<StationStatus, number> = {
  offline: 0,
  full: 1,
  lowBattery: 2,
  due: 3,
  filling: 4,
  maintenance: 5,
};

export function byUrgency(a: StationView, b: StationView): number {
  return statusRank[a.status] - statusRank[b.status] || a.bucketId - b.bucketId;
}

/** label, text color, badge background, and progress-bar fill for each status */
export const stationStatusMeta: Record<
  StationStatus,
  { label: string; color: string; bg: string; bar: string }
> = {
  filling: { label: "Filling", color: "#2E6B2B", bg: "#E3EFDF", bar: "var(--color-accent-mid)" },
  due: { label: "Due", color: "#7A5300", bg: "#FBEFCF", bar: "var(--color-status-attention)" },
  full: { label: "Full", color: "#7A3F00", bg: "#FBE0BE", bar: "#D98A1E" },
  lowBattery: { label: "Low battery", color: "#A3221A", bg: "#FBE3E0", bar: "var(--color-status-offline)" },
  offline: { label: "No signal", color: "#A3221A", bg: "#ECECE6", bar: "#B8B8B0" },
  maintenance: { label: "Maintenance", color: "#5E5A50", bg: "#ECECE6", bar: "#B8B8B0" },
};
