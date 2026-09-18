import type {
  Alert,
  Bucket,
  CollectionLog,
  DashboardMeta,
  Gateway,
  Metric,
  Node,
  Role,
  User,
} from "@/lib/types/schema";
import { lbsToLiters } from "@/lib/units";

const CAPACITY_LBS = 12;
const CAPACITY_LITERS = lbsToLiters(CAPACITY_LBS);

function iso(value: string) {
  return value;
}

export const roles: Role[] = [
  { id: 1, role_name: "club_lead" },
  { id: 2, role_name: "member" },
];

export const users: User[] = [
  {
    id: 1,
    role_id: 1,
    full_name: "Maple Club Lead",
    email: "lead@maplesugaring.club",
    created_at: iso("2026-01-12T10:00:00-05:00"),
  },
  {
    id: 2,
    role_id: 2,
    full_name: "Alex Rivera",
    email: "alex@maplesugaring.club",
    created_at: iso("2026-02-03T09:15:00-05:00"),
  },
];

export const gateways: Gateway[] = [
  {
    id: 1,
    gateway_code: "GW-NORTH-01",
    ip_address: "10.20.0.12",
    status: "online",
    last_ping: iso("2026-09-15T09:30:00-04:00"),
  },
];

export const nodes: Node[] = [
  {
    id: 1,
    gateway_id: 1,
    node_code: "Bucket #01",
    battery_level: 88.5,
    status: "online",
    installed_at: iso("2026-02-14T08:00:00-05:00"),
  },
  {
    id: 2,
    gateway_id: 1,
    node_code: "Bucket #02",
    battery_level: 91.0,
    status: "online",
    installed_at: iso("2026-02-14T08:10:00-05:00"),
  },
  {
    id: 3,
    gateway_id: 1,
    node_code: "Bucket #03",
    battery_level: 84.25,
    status: "online",
    installed_at: iso("2026-02-14T08:20:00-05:00"),
  },
  {
    id: 4,
    gateway_id: 1,
    node_code: "Bucket #04",
    battery_level: 76.5,
    status: "online",
    installed_at: iso("2026-02-16T09:00:00-05:00"),
  },
  {
    id: 5,
    gateway_id: 1,
    node_code: "Bucket #05",
    battery_level: 64.0,
    status: "online",
    installed_at: iso("2026-02-16T09:15:00-05:00"),
  },
];

export const buckets: Bucket[] = [
  {
    id: 1,
    node_id: 1,
    capacity_liters: CAPACITY_LITERS,
    tree_species: "Sugar Maple",
    installed_at: iso("2026-02-14T08:00:00-05:00"),
  },
  {
    id: 2,
    node_id: 2,
    capacity_liters: CAPACITY_LITERS,
    tree_species: "Sugar Maple",
    installed_at: iso("2026-02-14T08:10:00-05:00"),
  },
  {
    id: 3,
    node_id: 3,
    capacity_liters: CAPACITY_LITERS,
    tree_species: "Red Maple",
    installed_at: iso("2026-02-14T08:20:00-05:00"),
  },
  {
    id: 4,
    node_id: 4,
    capacity_liters: CAPACITY_LITERS,
    tree_species: "Sugar Maple",
    installed_at: iso("2026-02-16T09:00:00-05:00"),
  },
  {
    id: 5,
    node_id: 5,
    capacity_liters: CAPACITY_LITERS,
    tree_species: "Black Maple",
    installed_at: iso("2026-02-16T09:15:00-05:00"),
  },
];

export const alerts: Alert[] = [
  {
    id: 1,
    node_id: 4,
    alert_type: "high_fill",
    severity: "warning",
    message: "Bucket nearing capacity",
    is_resolved: false,
    created_at: iso("2026-09-15T08:42:00-04:00"),
  },
];

const dailyChartLbs = [
  { at: "2026-09-06T16:00:00-04:00", lbs: 5.2, bucketId: 1, nodeId: 1 },
  { at: "2026-09-07T16:00:00-04:00", lbs: 4.6, bucketId: 2, nodeId: 2 },
  { at: "2026-09-08T16:00:00-04:00", lbs: 3.0, bucketId: 3, nodeId: 3 },
  { at: "2026-09-09T16:00:00-04:00", lbs: 3.8, bucketId: 5, nodeId: 5 },
  { at: "2026-09-15T09:15:00-04:00", lbs: 1.9, bucketId: 4, nodeId: 4 },
];

export const collection_logs: CollectionLog[] = dailyChartLbs.map(
  (entry, index) => ({
    id: index + 1,
    user_id: 2,
    node_id: entry.nodeId,
    bucket_id: entry.bucketId,
    volume_collected_liters: lbsToLiters(entry.lbs),
    collected_at: iso(entry.at),
  }),
);

const trendByBucketLbs: Record<number, number[]> = {
  1: [2.1, 3.8, 5.2, 6.9, 7.4, 8.0, 8.4],
  2: [2.1, 3.8, 5.2, 6.9, 7.4, 8.6, 9.4],
  3: [2.1, 3.8, 5.2, 6.9, 7.4, 8.6, 9.4],
  4: [4.0, 6.2, 7.8, 9.1, 10.0, 10.9, 11.4],
  5: [0.8, 1.9, 2.8, 3.7, 4.5, 5.4, 6.2],
};

export const metrics: Metric[] = buckets.flatMap((bucket) => {
  const trend = trendByBucketLbs[bucket.id];
  return trend.map((lbs, index) => ({
    id: bucket.id * 10 + index + 1,
    recorded_by_user_id: null,
    node_id: bucket.node_id,
    bucket_id: bucket.id,
    fill_level_percent: (lbs / CAPACITY_LBS) * 100,
    sap_flow_rate_lph: index === trend.length - 1 ? 0.42 : 0.55,
    recorded_at: iso(
      index === trend.length - 1
        ? "2026-09-15T09:30:00-04:00"
        : `2026-09-${String(8 + index).padStart(2, "0")}T09:30:00-04:00`,
    ),
  }));
});

export const dashboardMeta: DashboardMeta = {
  seasonLabel: "Season 2026",
  currentDate: "2026-09-15",
  currentDateLabel: "Tuesday, September 15",
  currentDateShortLabel: "Tue, Sep 15",
  weather: {
    label: "Today's Condition",
    temperatureF: 27,
    lowF: 21,
    highF: 32,
    summary: "Cloudy",
  },
  sapCondition: {
    label: "Sap Condition",
    headline: "Freeze-Thaw conditions expected",
    flow: "Low",
  },
  weatherAlert: {
    message: "Weather Alert: Heavy Rain Expected",
  },
  production: {
    periodLabel: "Aug 31 - Today",
    sapCollectedLbs: 11,
    sapProcessedLbs: 3,
    syrupProducedLbs: 1,
  },
};
