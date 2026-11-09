import type { Batch, Collection, SeasonSummary, WeeklyCollectionPoint } from "@/lib/types/schema";

/**
 * Everything the app shows, as the worker API (and the weather forecast) returns it. The layout loads
 * it on the server for every render; lib/live/day.ts turns it into the `day` the screens read.
 */

/** One day of Rochester weather from Open-Meteo. `available: false` means no forecast was reachable. */
export interface WeatherDay {
  /** ISO date, e.g. "2026-10-19" */
  date: string;
  /** "Monday, October 19" */
  label: string;
  /** "Mon, Oct 19" */
  shortLabel: string;
  available: boolean;
  /** Now, for today; the day's average otherwise */
  temperatureF: number;
  lowF: number;
  highF: number;
  precipIn: number;
  snowIn: number;
  windMph: number;
  cloudPercent: number;
  summary: string;
}

/** GET /stations, one entry (worker/src/views.js getStations). */
export interface ApiStation {
  bucketId: number;
  nodeId: number | null;
  name: string;
  treeSpecies: string;
  status: "online" | "attention" | "offline";
  lastUpdated: string;
  currentLbs: number;
  capacityLbs: number;
  fillPercent: number;
  /** null when the node has never reported a battery level */
  batteryLevel: number | null;
  sapFlowLph: number;
  trend: number[];
  location: string | null;
  nodeCode: string | null;
  lastSeen: string | null;
  updatedAt: string | null;
  sensorOk: boolean | null;
  calibrated: boolean | null;
  isTestReading: boolean;
  mode: "normal" | "collection" | "maintenance";
  modeUntil: string | null;
  lat: number | null;
  lon: number | null;
  retired: boolean;
}

/** GET /alerts (open, plus those resolved in the last 7 days with ?all). */
export interface ApiAlert {
  id: number;
  node_id: number | null;
  bucket_id: number | null;
  alert_type: string;
  severity: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export interface ApiNote {
  id: number;
  text: string;
  author: string;
  /** ISO timestamp */
  createdAt: string;
}

export interface ApiNotes {
  bucket: Record<string, ApiNote[]>;
  batch: Record<string, ApiNote[]>;
}

/** GET /dashboard */
export interface ApiDashboard {
  seasonLabel: string;
  currentDate: string;
  production: {
    periodLabel: string;
    sapCollectedLbs: number;
    sapProcessedLbs: number;
    syrupProducedLbs: number;
  };
  weeklyCollection: WeeklyCollectionPoint[];
}

/** "live": the worker answered. "offline": WORKER_URL is unset or the worker is down. */
export type DataSource = "live" | "offline";

export interface LiveData {
  source: DataSource;
  /** Today in the club's time zone, "YYYY-MM-DD" */
  today: string;
  stations: ApiStation[];
  alerts: ApiAlert[];
  collections: Collection[];
  batches: Batch[];
  seasons: SeasonSummary[];
  dashboard: ApiDashboard | null;
  notes: ApiNotes;
  /** A window of days around today (past two weeks and the week ahead), forecast or not */
  weather: WeatherDay[];
}
