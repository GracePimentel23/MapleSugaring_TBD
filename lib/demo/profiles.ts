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
  /** "North Grove, tree 2" */
  treeLabel: string;
  sensorId: string;
  /** Where the tree is, for the Stations map */
  lat: number;
  lon: number;
}

/**
 * RIT taps trees on the grounds of the Joseph M. Lobozzo Alumni House (west side
 * of campus, Andrews Memorial Drive). The bucket positions around it are
 * placeholders until the club records where each tapped tree actually is.
 */
export const GROVE_CENTER = { lat: 43.08272, lon: -77.68595 };

export const CAPACITY_LBS = 12;

/** Extra battery drain on a hard-freeze night. */
export const COLD_BATTERY_PENALTY = 0.8;
export const COLD_NIGHT_THRESHOLD_F = 20;
export const LOW_BATTERY_THRESHOLD = 20;

export const bucketProfiles: BucketProfile[] = [
  {
    bucketId: 1,
    nodeId: 1,
    treeLabel: "North Grove, tree 1",
    sensorId: "SN-0141",
    name: "Bucket #01",
    location: "North Grove",
    treeSpecies: "Sugar Maple",
    yieldFactor: 1,
    startBatteryPercent: 88.5,
    batteryDrainPerDay: 0.45,
    reportTime: "9:30 AM",
    lat: 43.08309,
    lon: -77.68641,
  },
  {
    bucketId: 2,
    nodeId: 2,
    treeLabel: "North Grove, tree 2",
    sensorId: "SN-0142",
    name: "Bucket #02",
    location: "North Grove",
    treeSpecies: "Sugar Maple",
    yieldFactor: 0.88,
    startBatteryPercent: 91,
    batteryDrainPerDay: 0.4,
    reportTime: "9:28 AM",
    lat: 43.08319,
    lon: -77.68617,
  },
  {
    bucketId: 3,
    nodeId: 3,
    treeLabel: "South Ridge, tree 1",
    sensorId: "SN-0143",
    name: "Bucket #03",
    location: "South Ridge",
    treeSpecies: "Red Maple",
    yieldFactor: 1.22,
    startBatteryPercent: 84.25,
    batteryDrainPerDay: 0.5,
    reportTime: "9:31 AM",
    lat: 43.08232,
    lon: -77.6859,
  },
  {
    bucketId: 4,
    nodeId: 4,
    treeLabel: "East Slope, tree 1",
    sensorId: "SN-0144",
    name: "Bucket #04",
    location: "East Slope",
    treeSpecies: "Sugar Maple",
    yieldFactor: 0.8,
    startBatteryPercent: 76.5,
    batteryDrainPerDay: 0.9,
    reportTime: "8:15 AM",
    lat: 43.08268,
    lon: -77.68545,
  },
  {
    bucketId: 5,
    nodeId: 5,
    treeLabel: "West Field, tree 1",
    sensorId: "SN-0145",
    name: "Bucket #05",
    location: "West Field",
    treeSpecies: "Black Maple",
    yieldFactor: 0.62,
    startBatteryPercent: 41,
    batteryDrainPerDay: 1.75,
    reportTime: "9:12 AM",
    lat: 43.08262,
    lon: -77.68646,
  },
];

/** Shown instead of the normal report time once a node stops checking in. */
export const OFFLINE_REPORT_TIME = "6:02 AM";
