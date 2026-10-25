import type { Thresholds } from "@/lib/data/thresholds";
import type { LiveBucketState, LiveDay } from "@/lib/live/day";
import type { ApiAlert, WeatherDay } from "@/lib/live/types";
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

/** State layered on top of the API's stations. */
export interface StationOverrides {
  notes: Record<number, StationNote[]>;
}

/** Sap only ages while it is liquid: the afternoon thaw. Frozen sap keeps. */
const THAW_HIGH_F = 40;
const THAW_HOURS = 8;
const WARM_THAW_HOURS = 12;

/**
 * Thawed hours from the afternoon of `fromIso` up to (not including) `toIso`, from the weather window.
 * Days outside the window, or without a forecast, add nothing.
 */
export function liquidHours(fromIso: string, toIso: string, weather: WeatherDay[], warmHighF: number): number {
  let hours = 0;
  for (const day of weather) {
    if (!day.available || day.date < fromIso || day.date >= toIso) continue;
    if (day.highF > warmHighF) hours += WARM_THAW_HOURS;
    else if (day.highF >= THAW_HIGH_F) hours += THAW_HOURS;
  }
  return hours;
}

function shortName(name: string): string {
  return name.replace("Bucket ", "");
}

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The worker's open alerts that the rules below do not already judge (tipped bucket, sensor faults). */
function workerAlerts(bucket: LiveBucketState, open: ApiAlert[], location: string): ClubAlert[] {
  const base = { bucketId: bucket.bucketId, bucketLabel: shortName(bucket.name) };
  return open
    .filter((alert) => alert.bucket_id === bucket.bucketId || (alert.node_id !== null && alert.node_id === bucket.nodeId))
    .flatMap((alert): ClubAlert[] => {
      const shared = {
        ...base,
        alertId: alert.id,
        acknowledgedBy: alert.acknowledged_by,
        acknowledgedAt: alert.acknowledged_at,
        context: `${location} · ${whenLabel(alert.created_at)}. ${alert.message}.`,
      };
      if (alert.alert_type === "bucket_tipped") {
        return [
          {
            ...shared,
            key: `tipped-${alert.id}`,
            kind: "tipped",
            severity: "critical",
            title: `${bucket.name} may have been knocked over`,
            advice: `${location}. The weight dropped suddenly. Check the bucket.`,
            label: "Knocked over",
          },
        ];
      }
      if (alert.alert_type === "sensor_missing" || alert.alert_type === "out_of_range") {
        return [
          {
            ...shared,
            key: `sensor-${alert.id}`,
            kind: "sensor",
            severity: "warn",
            title:
              alert.alert_type === "sensor_missing"
                ? `${bucket.name} load cell is not detected`
                : `${bucket.name} reading is out of range`,
            advice: `${location}. ${alert.message}.`,
            label: "Sensor fault",
          },
        ];
      }
      return [];
    });
}

/** The worker's row for a condition judged here (offline, full), so acknowledging it reaches the API. */
function linkTo(alert: ClubAlert, open: ApiAlert[], bucket: LiveBucketState, type: string): ClubAlert {
  const row = open.find(
    (item) =>
      item.alert_type === type &&
      (item.bucket_id === bucket.bucketId || (item.node_id !== null && item.node_id === bucket.nodeId)),
  );
  return row ? { ...alert, alertId: row.id, acknowledgedBy: row.acknowledged_by, acknowledgedAt: row.acknowledged_at } : alert;
}

function bucketAlerts(
  day: LiveDay,
  bucket: LiveBucketState,
  station: {
    name: string;
    location: string;
    fillPercent: number;
    batteryLevel: number | null;
    sapAgeHours: number;
    lastUpdated: string;
  },
  thresholds: Thresholds,
  emptiedToday: boolean,
): ClubAlert[] {
  const alerts: ClubAlert[] = [];
  const { name, location, lastUpdated } = station;
  const base = { bucketId: bucket.bucketId, bucketLabel: shortName(name) };
  const open = day.alerts.filter((alert) => !alert.is_resolved);
  const extra = workerAlerts(bucket, open, location);

  if (bucket.nodeStatus === "offline") {
    alerts.push(
      linkTo(
        {
          ...base,
          key: `offline-${bucket.bucketId}`,
          kind: "offline",
          severity: "critical",
          title: `${name} has no signal`,
          advice: `${location}. No reading since ${lastUpdated}. Check the sensor.`,
          context: `${location} · since ${lastUpdated}. The sensor stopped reporting.`,
          label: "No signal",
        },
        open,
        bucket,
        "station_offline",
      ),
    );
    // A silent sensor has no fresh weight or battery reading to judge.
    return [...alerts, ...extra];
  }

  if (station.batteryLevel !== null) {
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
  }

  if (emptiedToday) return [...alerts, ...extra];

  const fill = Math.round(station.fillPercent);
  if (fill >= thresholds.fill.critical) {
    alerts.push(
      linkTo(
        {
          ...base,
          key: `full-${bucket.bucketId}`,
          kind: "full",
          severity: "critical",
          title: `${name} is full`,
          advice: `${location}. Empty it now or sap will overflow.`,
          context: `${location} · since ${lastUpdated}. At ${fill}% of the target weight.`,
          label: "Full",
        },
        open,
        bucket,
        "bucket_full",
      ),
    );
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

  const warm = day.weather.available && day.weather.highF > thresholds.warmSapAge.warn;
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

  return [...alerts, ...extra];
}

function statusFor(alerts: ClubAlert[], isOffline: boolean, inMaintenance: boolean): StationStatus {
  if (inMaintenance) return "maintenance";
  if (isOffline) return "offline";
  if (alerts.some((alert) => alert.kind === "full" || alert.kind === "tipped")) return "full";
  if (alerts.some((alert) => alert.kind === "battery" || alert.kind === "sensor")) return "lowBattery";
  if (alerts.some((alert) => alert.kind === "due" || alert.kind === "sapAge")) return "due";
  return "filling";
}

export function getStationCards(
  day: LiveDay,
  weather: WeatherDay[],
  overrides: StationOverrides,
  thresholds: Thresholds,
): StationView[] {
  return day.buckets.map((bucket) => {
    const isOffline = bucket.nodeStatus === "offline";
    const inMaintenance = bucket.mode === "maintenance";
    // Emptied today: a collection logged today reached it, and it has not filled back up yet.
    const loggedToday = bucket.lastCollectedOn === day.date && bucket.fillPercent < 5;
    const sapAge = bucket.lastCollectedOn
      ? liquidHours(bucket.lastCollectedOn, day.date, weather, thresholds.warmSapAge.warn)
      : 0;

    const facts = {
      name: bucket.name,
      location: bucket.location,
      fillPercent: bucket.fillPercent,
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
      treeLabel: bucket.treeLabel,
      sensorId: bucket.sensorId,
      treeSpecies: bucket.treeSpecies,
      lat: bucket.lat,
      lon: bucket.lon,
      hasPosition: bucket.hasPosition,
      status: statusFor(live, isOffline, inMaintenance),
      isOffline,
      inMaintenance,
      modeUntil: bucket.modeUntil,
      // Maintenance pauses alerts for the bucket while its sensor is serviced.
      alerts: inMaintenance ? [] : live,
      notes: overrides.notes[bucket.bucketId] ?? [],
      lastUpdated: bucket.lastUpdated,
      currentLbs: bucket.fillLbs,
      capacityLbs: bucket.capacityLbs,
      fillPercent: bucket.fillPercent,
      batteryLevel: bucket.batteryPercent,
      sapFlowLph: bucket.sapFlowLph,
      sapAgeHours: sapAge,
      loggedToday,
      trend: bucket.trend,
    };
  });
}

/** Grove-wide weather alerts for the day, from the forecast. */
export function getWeatherAlerts(day: LiveDay, thresholds: Thresholds): ClubAlert[] {
  if (!day.weather.available) return [];
  const base = { bucketId: null, bucketLabel: "All", key: `weather-${day.date}`, kind: "weather" as const };
  const { highF, lowF } = day.weather;

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
