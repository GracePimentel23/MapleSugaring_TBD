import type { DemoDay } from "@/lib/demo/timeline";
import type { Alert, StationNote, StationStatus, StationView } from "@/lib/types/schema";

/** Client-side state layered on top of the timeline: admin toggles and notes. */
export interface StationOverrides {
  maintenance: ReadonlySet<number>;
  notes: Record<number, StationNote[]>;
}

export function getStationCards(day: DemoDay, overrides: StationOverrides): StationView[] {
  return day.buckets.map((bucket) => {
    const isOffline = bucket.nodeStatus === "offline";
    const inMaintenance = overrides.maintenance.has(bucket.bucketId);
    const status: StationStatus = inMaintenance
      ? "maintenance"
      : isOffline
        ? "offline"
        : "online";

    return {
      bucketId: bucket.bucketId,
      nodeId: bucket.nodeId,
      name: bucket.name,
      location: bucket.location,
      treeSpecies: bucket.treeSpecies,
      status,
      isOffline,
      inMaintenance,
      alerts: getUnresolvedAlertsForNode(day, bucket.nodeId),
      notes: overrides.notes[bucket.bucketId] ?? [],
      lastUpdated: bucket.lastUpdated,
      currentLbs: bucket.fillLbs,
      capacityLbs: bucket.capacityLbs,
      fillPercent: bucket.fillPercent,
      batteryLevel: bucket.batteryPercent,
      sapFlowLph: bucket.sapFlowLph,
      trend: bucket.trend,
    };
  });
}

export function needsAttention(station: StationView): boolean {
  return station.isOffline || station.alerts.length > 0;
}

export function getStationSummary(day: DemoDay, overrides: StationOverrides) {
  const stations = getStationCards(day, overrides);
  const onlineCount = stations.filter((station) => station.status === "online").length;
  const alertCount = day.alerts.filter((alert) => !alert.is_resolved).length;

  return {
    stations,
    onlineCount,
    alertCount,
    summaryLabel: `${onlineCount} online · ${alertCount} alert${alertCount === 1 ? "" : "s"}`,
  };
}

export function getUnresolvedAlertsForNode(day: DemoDay, nodeId: number): Alert[] {
  return day.alerts.filter(
    (alert) => alert.node_id === nodeId && !alert.is_resolved,
  );
}

/** Short headline for an alert, used in the bell and on station cards. */
export function alertHeadline(alert: Alert, stationName: string): string {
  if (alert.alert_type === "node_offline") return `${stationName} is offline`;
  if (alert.alert_type === "high_fill") return `${stationName} is full`;
  if (alert.alert_type === "low_battery") return `${stationName} battery is low`;
  return `${stationName} needs attention`;
}

/** The warning line under a station card's progress bar. */
export function alertWarning(alert: Alert, station: StationView): string {
  if (alert.alert_type === "high_fill") {
    return "Bucket is at capacity. Please check the station.";
  }
  if (alert.alert_type === "low_battery") {
    return `Battery at ${Math.round(station.batteryLevel)}%. Please check the station.`;
  }
  return `${alert.message}. Please check the station.`;
}

export const stationStatusMeta: Record<
  StationStatus,
  { label: string; color: string; bg: string }
> = {
  online: {
    label: "Online",
    color: "var(--color-status-online)",
    bg: "rgba(34,197,94,0.12)",
  },
  maintenance: { label: "Maintenance", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  offline: { label: "Offline", color: "#DC2626", bg: "rgba(239,68,68,0.12)" },
};

/** Flat fills on the dashboard stations panel. */
export function panelProgressFill(status: StationStatus): string {
  if (status === "maintenance") return "#F59E0B";
  if (status === "offline") return "#EF4444";
  return "#2B4A1E";
}

/** Flat fills on the Stations page cards. Maintenance is greyed out. */
export function cardProgressFill(status: StationStatus): string {
  if (status === "maintenance") return "#9CA3AF";
  if (status === "offline") return "#EF4444";
  return "#2B4A1E";
}
