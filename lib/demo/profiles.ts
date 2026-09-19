/**
 * Per-bucket producer profiles for the demo.
 *
 * Each bucket behaves differently so the scripted alerts land somewhere
 * believable instead of firing at random:
 *
 *  #01 North Grove  - strong, reliable baseline
 *  #02 North Grove  - solid, trails #01 slightly
 *  #03 South Ridge  - best sun exposure, biggest producer, fills first
 *  #04 East Slope   - flaky node, slowest to report, drops out first in snow
 *  #05 West Field   - lags on volume and has the weakest battery
 */

export interface BucketProfile {
  bucketId: number;
  nodeId: number;
  name: string;
  location: string;
  treeSpecies: string;
  /** Multiplier applied to the day's base sap yield */
  yieldFactor: number;
  startBatteryPercent: number;
  /** Battery percentage points lost per day */
  batteryDrainPerDay: number;
  /** Time of day this node normally reports in */
  reportTime: string;
}

export const CAPACITY_LBS = 12;

/** Extra battery drain on a hard-freeze night. */
export const COLD_BATTERY_PENALTY = 0.8;
export const COLD_NIGHT_THRESHOLD_F = 20;
export const LOW_BATTERY_THRESHOLD = 20;

export const bucketProfiles: BucketProfile[] = [
  {
    bucketId: 1,
    nodeId: 1,
    name: "Bucket #01",
    location: "North Grove",
    treeSpecies: "Sugar Maple",
    yieldFactor: 1,
    startBatteryPercent: 88.5,
    batteryDrainPerDay: 0.45,
    reportTime: "9:30AM",
  },
  {
    bucketId: 2,
    nodeId: 2,
    name: "Bucket #02",
    location: "North Grove",
    treeSpecies: "Sugar Maple",
    yieldFactor: 0.88,
    startBatteryPercent: 91,
    batteryDrainPerDay: 0.4,
    reportTime: "9:28AM",
  },
  {
    bucketId: 3,
    nodeId: 3,
    name: "Bucket #03",
    location: "South Ridge",
    treeSpecies: "Red Maple",
    yieldFactor: 1.22,
    startBatteryPercent: 84.25,
    batteryDrainPerDay: 0.5,
    reportTime: "9:31AM",
  },
  {
    bucketId: 4,
    nodeId: 4,
    name: "Bucket #04",
    location: "East Slope",
    treeSpecies: "Sugar Maple",
    yieldFactor: 0.8,
    startBatteryPercent: 76.5,
    batteryDrainPerDay: 0.9,
    reportTime: "8:15AM",
  },
  {
    bucketId: 5,
    nodeId: 5,
    name: "Bucket #05",
    location: "West Field",
    treeSpecies: "Black Maple",
    yieldFactor: 0.62,
    startBatteryPercent: 41,
    batteryDrainPerDay: 1.75,
    reportTime: "9:12AM",
  },
];

/** Shown instead of the normal report time once a node stops checking in. */
export const OFFLINE_REPORT_TIME = "6:02AM";
