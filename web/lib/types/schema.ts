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

/**
 * What a station card says about its bucket, most urgent first:
 * maintenance (set by a manager) > offline > full > low battery > due > filling.
 */
export type StationStatus =
  | "filling"
  | "due"
  | "full"
  | "lowBattery"
  | "offline"
  | "maintenance";

export type UserRole = "admin" | "student" | "guest";

export interface StationNote {
  id?: number;
  text: string;
  author: string;
  createdAt: string;
}

/** tipped and sensor come from the worker (bucket_tipped, sensor_missing / out_of_range); the rest are judged here. */
export type AlertKind = "offline" | "full" | "due" | "sapAge" | "battery" | "weather" | "tipped" | "sensor";

export type AlertSeverity = "warn" | "critical";

/** A live condition that needs someone's attention. Derived from the day's readings. */
export interface ClubAlert {
  /** Stable across days for the same condition on the same bucket */
  key: string;
  kind: AlertKind;
  severity: AlertSeverity;
  /** null for grove-wide alerts such as weather */
  bucketId: number | null;
  /** "#02", or "All" */
  bucketLabel: string;
  title: string;
  /** Short advice, for the dashboard */
  advice: string;
  /** Location and since, for the Alerts page */
  context: string;
  /** Status word shown in history tables: "Due", "Full", "No signal"... */
  label: string;
  /** The worker's alert row behind this, if any: acknowledging or resolving it goes to the API */
  alertId?: number;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
}

export interface StationView {
  bucketId: number;
  nodeId: number;
  name: string;
  /** "#02" */
  shortName: string;
  location: string;
  /** "North Grove, tree 2" */
  treeLabel: string;
  sensorId: string;
  treeSpecies: string;
  lat: number;
  lon: number;
  status: StationStatus;
  /** Hardware state, independent of the maintenance toggle */
  isOffline: boolean;
  inMaintenance: boolean;
  /** Live alerts for this bucket, before acknowledgement */
  alerts: ClubAlert[];
  /** Newest first */
  notes: StationNote[];
  lastUpdated: string;
  currentLbs: number;
  capacityLbs: number;
  fillPercent: number;
  /** null until the node reports a battery level */
  batteryLevel: number | null;
  sapFlowLph: number;
  /** When maintenance or collection mode switches itself off (ISO), or null in normal mode */
  modeUntil: string | null;
  /** false while the map pin is only a placeholder spot */
  hasPosition: boolean;
  /** Hours the sap has sat thawed since the last collection */
  sapAgeHours: number;
  /** Emptied by a collection logged in the app today */
  loggedToday: boolean;
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
    precipIn: number;
    snowIn: number;
    windMph: number;
    cloudPercent: number;
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

export interface CollectionEntry {
  bucketId: number;
  bucketName: string;
  collectedBy: string;
  lbs: number;
}

export interface Collection {
  id: string;
  collectionNumber: number;
  date: string;
  entries: CollectionEntry[];
  totalLbs: number;
  batchName: string;
  loggedBy: string;
  notes?: string;
}

export type BatchStatus = "completed" | "processing" | "active" | "waiting";

export interface Batch {
  id: string;
  batchNumber: string;
  date: string;
  status: BatchStatus;
  sapInLbs: number;
  syrupOutLbs: number;
  brix: number;
  createdBy: string;
  notes?: string;
  /** Time on the evaporator, once finished */
  boilMinutes?: number;
}

export interface SeasonFlowPoint {
  /** ISO date of the day, when known */
  date?: string;
  week: string;
  lbs: number;
  temp: number;
}

export interface SeasonSummary {
  season: string;
  totalSapLbs: number;
  totalSyrupLbs: number;
  avgBrix: number;
  sapToSyrupRatio: number;
  totalCollections: number;
  totalBatches: number;
  avgTempF: number;
  weeklyFlow: SeasonFlowPoint[];
}
