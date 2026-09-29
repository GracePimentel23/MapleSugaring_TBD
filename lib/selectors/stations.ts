import { alerts, buckets, metrics, nodes } from "@/lib/data/mock";
import type {
  Alert,
  Node,
  StationDisplayStatus,
  StationUiStatus,
  StationView,
} from "@/lib/types/schema";
import { litersToLbs } from "@/lib/units";

function formatUpdatedAt(isoDate: string): string {
  const match = isoDate.match(/T(\d{2}):(\d{2})/);
  if (!match) return "—";
  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute}${period}`;
}

function stationStatus(node: Node, nodeAlerts: Alert[]): StationUiStatus {
  if (node.status === "offline") return "offline";
  if (nodeAlerts.some((alert) => !alert.is_resolved)) return "attention";
  return "online";
}

/**
 * The Stations page uses complete / in_progress / offline, driven by how full
 * the bucket is. Offline always wins.
 */
function stationDisplayStatus(node: Node, fillPercent: number): StationDisplayStatus {
  if (node.status === "offline") return "offline";
  if (fillPercent >= 100) return "complete";
  return "in_progress";
}

export function getStationCards(): StationView[] {
  return buckets.map((bucket) => {
    const node = nodes.find((item) => item.id === bucket.node_id);
    if (!node) {
      throw new Error(`Missing node ${bucket.node_id} for bucket ${bucket.id}`);
    }

    const nodeAlerts = alerts.filter((alert) => alert.node_id === node.id);
    const bucketMetrics = metrics
      .filter((metric) => metric.bucket_id === bucket.id)
      .sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      );
    const latest = bucketMetrics[bucketMetrics.length - 1];
    const capacityLbs = litersToLbs(bucket.capacity_liters);
    const fillPercent = latest?.fill_level_percent ?? 0;
    const currentLbs = litersToLbs((fillPercent / 100) * bucket.capacity_liters);

    return {
      bucketId: bucket.id,
      nodeId: node.id,
      name: node.node_code,
      treeSpecies: bucket.tree_species,
      status: stationStatus(node, nodeAlerts),
      displayStatus: stationDisplayStatus(node, fillPercent),
      lastUpdated: latest ? formatUpdatedAt(latest.recorded_at) : "—",
      currentLbs,
      capacityLbs,
      fillPercent,
      batteryLevel: node.battery_level,
      sapFlowLph: latest?.sap_flow_rate_lph ?? 0,
      trend: bucketMetrics.map((metric) =>
        litersToLbs((metric.fill_level_percent / 100) * bucket.capacity_liters),
      ),
    };
  });
}

export function getStationSummary() {
  const stations = getStationCards();
  const onlineCount = nodes.filter((node) => node.status === "online").length;
  const alertCount = alerts.filter((alert) => !alert.is_resolved).length;

  return {
    stations,
    onlineCount,
    alertCount,
    summaryLabel: `${onlineCount} online · ${alertCount} alert${alertCount === 1 ? "" : "s"}`,
  };
}

export function getUnresolvedAlertsForNode(nodeId: number): Alert[] {
  return alerts.filter((alert) => alert.node_id === nodeId && !alert.is_resolved);
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
