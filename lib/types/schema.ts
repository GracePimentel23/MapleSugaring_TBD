export interface Role {
  id: number;
  role_name: string;
}

export interface User {
  id: number;
  role_id: number;
  full_name: string;
  email: string;
  created_at: string;
}

export interface Gateway {
  id: number;
  gateway_code: string;
  ip_address: string;
  status: string;
  last_ping: string;
}

export interface Node {
  id: number;
  gateway_id: number;
  node_code: string;
  battery_level: number;
  status: string;
  installed_at: string;
}

export interface Bucket {
  id: number;
  node_id: number;
  capacity_liters: number;
  tree_species: string;
  installed_at: string;
}

export interface Alert {
  id: number;
  node_id: number;
  alert_type: string;
  severity: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
}

export interface CollectionLog {
  id: number;
  user_id: number;
  node_id: number;
  bucket_id: number;
  volume_collected_liters: number;
  collected_at: string;
}

export interface Metric {
  id: number;
  recorded_by_user_id: number | null;
  node_id: number;
  bucket_id: number;
  fill_level_percent: number;
  sap_flow_rate_lph: number;
  recorded_at: string;
}

export type StationUiStatus = "online" | "attention" | "offline";

export interface StationView {
  bucketId: number;
  nodeId: number;
  name: string;
  treeSpecies: string;
  status: StationUiStatus;
  lastUpdated: string;
  currentLbs: number;
  capacityLbs: number;
  fillPercent: number;
  batteryLevel: number;
  sapFlowLph: number;
  trend: number[];
}

export interface DashboardMeta {
  seasonLabel: string;
  currentDate: string;
  currentDateLabel: string;
  currentDateShortLabel: string;
  weather: {
    label: string;
    temperatureF: number;
    lowF: number;
    highF: number;
    summary: string;
  };
  sapCondition: {
    label: string;
    headline: string;
    flow: string;
  };
  weatherAlert: {
    message: string;
  } | null;
  production: {
    periodLabel: string;
    sapCollectedLbs: number;
    sapProcessedLbs: number;
    syrupProducedLbs: number;
  };
}

export interface WeeklyCollectionPoint {
  day: string;
  lbs: number;
}

export interface ProductionStat {
  label: string;
  value: string;
}
