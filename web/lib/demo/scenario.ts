import type { ApiAlert, ApiStation, LiveData, WeatherDay } from "@/lib/live/types";

/**
 * DEMO DATA (front end only, nothing is written to the worker). It layers a few things on top of
 * what the worker and the forecast send, so every kind of alert and weather shows up while
 * designing:
 *
 *  - Buckets in different states: low battery and a sensor fault (#01), knocked over (#02),
 *    due (#03), no signal (#05). #04 stays as the worker reports it (full).
 *  - A few alerts resolved in the past week, so Resolved This Week has rows.
 *  - Snow, ice, a good sap day and a best sap day in the past two weeks and the forecast, and
 *    today's weather can be swapped for any of them in Settings > Display > Demo data.
 *
 * Demo alerts have negative ids; resolving one only hides it in this browser (see
 * StationStateProvider.resolve). Turn it all off in Settings, or with DEMO_DATA=off in the
 * environment. To remove it later: delete this file, its call in lib/live/load.ts, DemoDataCard in
 * components/settings, and the `alertId < 0` check in StationStateProvider.
 */

/** Cookie the Settings card writes: which weather today shows, or "off" for no demo data at all. */
export const DEMO_COOKIE = "tbd-demo";

export type DemoWeather = "real" | "snow" | "ice" | "good" | "best";
export type DemoChoice = DemoWeather | "off";

export const DEMO_CHOICES: { value: DemoChoice; label: string; detail: string }[] = [
  { value: "real", label: "Real forecast", detail: "Today as Rochester reports it" },
  { value: "snow", label: "Snow day", detail: "Heavy snow, 18° to 29°F" },
  { value: "ice", label: "Ice storm", detail: "Freezing rain, 27° to 33°F" },
  { value: "good", label: "Good sap day", detail: "Freezes at night, 41°F by day" },
  { value: "best", label: "Best sap day", detail: "Hard freeze, sunny, 45°F by day" },
  { value: "off", label: "No demo data", detail: "Only what the worker and forecast send" },
];

export function parseDemoChoice(value: string | undefined): DemoChoice {
  if (process.env.DEMO_DATA === "off") return "off";
  return DEMO_CHOICES.some((choice) => choice.value === value) ? (value as DemoChoice) : "real";
}

type Preset = Omit<WeatherDay, "date" | "label" | "shortLabel">;

const PRESETS: Record<Exclude<DemoWeather, "real">, Preset> = {
  snow: {
    available: true,
    temperatureF: 24,
    lowF: 18,
    highF: 29,
    precipIn: 0.52,
    snowIn: 6.2,
    windMph: 14,
    cloudPercent: 96,
    summary: "Heavy snow",
  },
  ice: {
    available: true,
    temperatureF: 31,
    lowF: 27,
    highF: 33,
    precipIn: 0.45,
    snowIn: 0,
    windMph: 12,
    cloudPercent: 100,
    summary: "Freezing rain",
  },
  good: {
    available: true,
    temperatureF: 38,
    lowF: 27,
    highF: 41,
    precipIn: 0,
    snowIn: 0,
    windMph: 6,
    cloudPercent: 45,
    summary: "Partly cloudy",
  },
  best: {
    available: true,
    temperatureF: 43,
    lowF: 22,
    highF: 45,
    precipIn: 0,
    snowIn: 0,
    windMph: 4,
    cloudPercent: 5,
    summary: "Clear",
  },
};

/** Days from today that get a demo preset. Outlook (the next four days) shows all four kinds. */
const WEATHER_PLAN: Record<number, Exclude<DemoWeather, "real">> = {
  [-9]: "snow",
  [-7]: "ice",
  [-3]: "good",
  [-2]: "best",
  1: "snow",
  2: "ice",
  3: "good",
  4: "best",
};

const DAY_MS = 86_400_000;

function offsetFrom(today: string, iso: string): number {
  return Math.round((new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / DAY_MS);
}

function demoWeather(window: WeatherDay[], today: string, todayPick: DemoWeather): WeatherDay[] {
  return window.map((day) => {
    const offset = offsetFrom(today, day.date);
    const kind = offset === 0 ? (todayPick === "real" ? undefined : todayPick) : WEATHER_PLAN[offset];
    return kind ? { ...day, ...PRESETS[kind] } : day;
  });
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function demoStations(stations: ApiStation[]): ApiStation[] {
  return stations.map((station): ApiStation => {
    switch (station.bucketId) {
      case 1:
        // Low battery (and the sensor fault below)
        return { ...station, batteryLevel: 22, status: "attention" };
      case 2: {
        // Knocked over: the weight fell off in one reading
        const lbs = Math.round(station.capacityLbs * 0.12 * 10) / 10;
        const at = hoursAgo(0.7);
        return {
          ...station,
          currentLbs: lbs,
          fillPercent: 12,
          status: "attention",
          sapFlowLph: 0,
          updatedAt: at,
          lastSeen: at,
          lastUpdated: at,
        };
      }
      case 3: {
        // Due: past the 80% mark
        const lbs = Math.round(station.capacityLbs * 0.86 * 10) / 10;
        return { ...station, currentLbs: lbs, fillPercent: 86, status: "attention" };
      }
      case 5: {
        // No signal for six hours
        const last = hoursAgo(6);
        return { ...station, status: "offline", updatedAt: last, lastSeen: last, lastUpdated: last, sapFlowLph: 0 };
      }
      default:
        return station;
    }
  });
}

function demoAlerts(stations: ApiStation[]): ApiAlert[] {
  const node = (bucketId: number) => stations.find((station) => station.bucketId === bucketId)?.nodeId ?? null;
  const open = (
    id: number,
    bucketId: number,
    type: string,
    severity: string,
    message: string,
    createdHoursAgo: number,
  ): ApiAlert => ({
    id,
    node_id: node(bucketId),
    bucket_id: bucketId,
    alert_type: type,
    severity,
    message,
    is_resolved: false,
    created_at: hoursAgo(createdHoursAgo),
    resolved_at: null,
    resolved_by: null,
    acknowledged_at: null,
    acknowledged_by: null,
  });
  const resolved = (alert: ApiAlert, resolvedHoursAgo: number, by: string | null): ApiAlert => ({
    ...alert,
    is_resolved: true,
    resolved_at: hoursAgo(resolvedHoursAgo),
    resolved_by: by,
  });

  return [
    open(-1, 2, "bucket_tipped", "critical", "The weight dropped from 78% to 12% in one reading", 0.7),
    open(-2, 1, "out_of_range", "warning", "The load cell read 212 lbs, past what it can measure", 3),
    resolved(open(-3, 3, "station_offline", "critical", "No reading for 2 hours", 52), 49, null),
    resolved(open(-4, 2, "bucket_full", "critical", "At 96% of the target weight", 30), 27, "Alex Rivera"),
    resolved(open(-5, 5, "sensor_missing", "warning", "The load cell is not detected", 80), 76, "Alex Rivera"),
    resolved(open(-6, 4, "bucket_tipped", "critical", "The weight dropped from 64% to 5% in one reading", 120), 118, "Tester"),
  ];
}

/** The worker's data with the demo layered on, or unchanged when the demo is off. */
export function withDemoData(data: LiveData, choice: DemoChoice): LiveData {
  if (choice === "off") return data;
  const stations = data.source === "live" ? demoStations(data.stations) : data.stations;
  return {
    ...data,
    stations,
    alerts: data.source === "live" ? [...data.alerts, ...demoAlerts(data.stations)] : data.alerts,
    weather: demoWeather(data.weather, data.today, choice),
  };
}
