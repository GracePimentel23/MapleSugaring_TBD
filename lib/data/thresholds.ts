/**
 * Alert thresholds. Alerts fire when a reading crosses these; only the
 * Owner / IT account can change them.
 */

export type ThresholdKey =
  | "fill"
  | "overflow"
  | "sapAge"
  | "warmSapAge"
  | "sensorSilent"
  | "battery"
  | "knockedOver"
  | "hardFreeze"
  | "heat";

export interface ThresholdDef {
  key: ThresholdKey;
  label: string;
  description: string;
  /** Formats the stored number for display */
  warnFormat: (value: number) => string;
  criticalFormat: (value: number) => string;
  /** Unit shown next to the edit inputs */
  warnUnit: string;
  criticalUnit: string;
}

export type Thresholds = Record<ThresholdKey, { warn: number; critical: number }>;

const pct = (value: number) => `${value}%`;
const hours = (value: number) => `${value} hours`;
const lbs = (value: number) => `${value} lbs`;
const deg = (value: number) => `${value}°F`;

export const thresholdDefs: ThresholdDef[] = [
  {
    key: "fill",
    label: "Bucket fill",
    description: "Percent of target weight. Warn shows Due, critical shows Full",
    warnFormat: pct,
    criticalFormat: pct,
    warnUnit: "%",
    criticalUnit: "%",
  },
  {
    key: "overflow",
    label: "Overflowing",
    description: "Weight over the target",
    warnFormat: pct,
    criticalFormat: pct,
    warnUnit: "%",
    criticalUnit: "%",
  },
  {
    key: "sapAge",
    label: "Sap age",
    description: "Hours the sap has sat thawed since the bucket was last collected",
    warnFormat: hours,
    criticalFormat: hours,
    warnUnit: "h",
    criticalUnit: "h",
  },
  {
    key: "warmSapAge",
    label: "Sap age on warm days",
    description: "Limit drops when the forecast high is above",
    warnFormat: deg,
    criticalFormat: hours,
    warnUnit: "°F",
    criticalUnit: "h",
  },
  {
    key: "sensorSilent",
    label: "Sensor silent",
    description: "No reading for. Warn shows No signal, critical shows Offline",
    warnFormat: (value) => (value < 60 ? `${value} min` : hours(value / 60)),
    criticalFormat: (value) => (value < 60 ? `${value} min` : `${value / 60} hours`),
    warnUnit: "min",
    criticalUnit: "min",
  },
  {
    key: "battery",
    label: "Low battery",
    description: "Charge remaining",
    warnFormat: pct,
    criticalFormat: pct,
    warnUnit: "%",
    criticalUnit: "%",
  },
  {
    key: "knockedOver",
    label: "Knocked over",
    description: "Weight lost within 10 minutes",
    warnFormat: lbs,
    criticalFormat: lbs,
    warnUnit: "lbs",
    criticalUnit: "lbs",
  },
  {
    key: "hardFreeze",
    label: "Hard freeze",
    description: "Forecast overnight low",
    warnFormat: (value) => `Below ${value}°F`,
    criticalFormat: (value) => `Below ${value}°F`,
    warnUnit: "°F",
    criticalUnit: "°F",
  },
  {
    key: "heat",
    label: "Heat event",
    description: "Forecast daytime high",
    warnFormat: (value) => `Above ${value}°F`,
    criticalFormat: (value) => `Above ${value}°F`,
    warnUnit: "°F",
    criticalUnit: "°F",
  },
];

export const defaultThresholds: Thresholds = {
  fill: { warn: 80, critical: 95 },
  overflow: { warn: 5, critical: 15 },
  sapAge: { warn: 24, critical: 48 },
  warmSapAge: { warn: 50, critical: 12 },
  sensorSilent: { warn: 30, critical: 120 },
  battery: { warn: 30, critical: 15 },
  knockedOver: { warn: 2, critical: 4 },
  hardFreeze: { warn: 10, critical: 0 },
  heat: { warn: 50, critical: 55 },
};
