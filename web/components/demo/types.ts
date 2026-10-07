/** GET /demo (worker/src/demo.js). The Demo tab is temporary, for the sponsor video. */
export type StationMode = "normal" | "collection" | "maintenance";

export interface DemoState {
  stations: { bucketId: number; name: string }[];
  station: {
    bucketId: number;
    name: string;
    nodeCode: string | null;
    online: boolean;
    lastSeen: string | null;
    rssi: number | null;
    mode: StationMode;
    modeUntil: string | null;
    tareLbs: number;
    calibrationFactor: number;
    capacityLbs: number;
    weightLbs: number | null;
    exactWeightLbs: number | null;
    measuredAt: string | null;
    settled: boolean;
    recent: { at: string; lbs: number }[];
  } | null;
  alerts: { id: number; alert_type: string; severity: string; message: string; created_at: string }[];
  calibration: {
    points: { id: number; knownLbs: number; measuredLbs: number; readsLbs: number; errorLbs: number }[];
    suggestedFactor: number | null;
  };
  email: { configured: boolean; to: string[] };
  modeMinutes: number;
}
