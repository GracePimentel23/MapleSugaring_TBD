import { alerts, buckets, metrics, nodes } from "@/lib/data/mock";
import type { Alert, Node, StationUiStatus, StationView } from "@/lib/types/schema";
import { formatLbsNumber, litersToLbs } from "@/lib/units";

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

export function formatFillLabel(station: StationView): string {
  return `${formatLbsNumber(station.currentLbs)} / ${formatLbsNumber(station.capacityLbs)} lbs`;
}
