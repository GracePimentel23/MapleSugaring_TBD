import type { DemoBucketState, DemoDay } from "@/lib/demo/timeline";
import type {
  Alert,
  StationDisplayStatus,
  StationUiStatus,
  StationView,
} from "@/lib/types/schema";
/**
 * The dashboard stations panel uses online / attention / offline, driven by the
 * node and its unresolved alerts.
 */
function stationUiStatus(bucket: DemoBucketState, alerts: Alert[]): StationUiStatus {
  if (bucket.nodeStatus === "offline") return "offline";

  const hasUnresolved = alerts.some(
    (alert) => alert.node_id === bucket.nodeId && !alert.is_resolved,
  );

  return hasUnresolved ? "attention" : "online";
}

/**
 * The Stations page uses complete / in_progress / offline, driven by how full
 * the bucket is. Offline always wins.
 */
function stationDisplayStatus(bucket: DemoBucketState): StationDisplayStatus {
  if (bucket.nodeStatus === "offline") return "offline";
  if (bucket.isFull) return "complete";
  return "in_progress";
}

export function getStationCards(day: DemoDay): StationView[] {
  return day.buckets.map((bucket) => ({
    bucketId: bucket.bucketId,
    nodeId: bucket.nodeId,
    name: bucket.name,
    location: bucket.location,
    treeSpecies: bucket.treeSpecies,
    status: stationUiStatus(bucket, day.alerts),
    displayStatus: stationDisplayStatus(bucket),
    lastUpdated: bucket.lastUpdated,
    currentLbs: bucket.fillLbs,
    capacityLbs: bucket.capacityLbs,
    fillPercent: bucket.fillPercent,
    batteryLevel: bucket.batteryPercent,
    sapFlowLph: bucket.sapFlowLph,
    trend: bucket.trend,
  }));
}

export function getStationSummary(day: DemoDay) {
  const stations = getStationCards(day);
  const onlineCount = day.buckets.filter(
    (bucket) => bucket.nodeStatus === "online",
  ).length;
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

/** Flat fills on the dashboard stations panel. */
export function panelProgressFill(status: StationUiStatus): string {
  if (status === "attention") return "#F59E0B";
  if (status === "offline") return "#EF4444";
  return "#2B4A1E";
}

/** Flat fills on the Stations page cards. */
export function cardProgressFill(status: StationDisplayStatus): string {
  if (status === "complete") return "#2B4A1E";
  if (status === "in_progress") return "#3B82F6";
  return "#D1D5DB";
}
