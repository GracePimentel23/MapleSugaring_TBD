import {
  BatteryIcon,
  ClockIcon,
  CloudIcon,
  FullIcon,
  PauseIcon,
  SignalOffIcon,
} from "@/components/icons";
import type { AlertKind, ClubAlert, StationView } from "@/lib/types/schema";

export type AlertIconKind = AlertKind | "maintenance";

const iconFor: Record<AlertIconKind, { Icon: typeof BatteryIcon; color: string }> = {
  battery: { Icon: BatteryIcon, color: "var(--color-status-problem)" },
  offline: { Icon: SignalOffIcon, color: "var(--color-status-problem)" },
  sapAge: { Icon: ClockIcon, color: "#B07D00" },
  due: { Icon: ClockIcon, color: "#B07D00" },
  full: { Icon: FullIcon, color: "#B07D00" },
  weather: { Icon: CloudIcon, color: "var(--color-slate)" },
  maintenance: { Icon: PauseIcon, color: "var(--color-slate)" },
  tipped: { Icon: FullIcon, color: "var(--color-status-problem)" },
  sensor: { Icon: SignalOffIcon, color: "#B07D00" },
};

/** Text color for an alert's status word in history tables. */
export const alertLabelColor: Record<AlertIconKind, string> = {
  battery: "var(--color-status-problem)",
  offline: "var(--color-status-problem)",
  sapAge: "var(--color-status-due)",
  due: "var(--color-status-due)",
  full: "var(--color-status-due)",
  weather: "var(--color-slate)",
  maintenance: "var(--color-slate)",
  tipped: "var(--color-status-problem)",
  sensor: "var(--color-status-due)",
};

export type Urgency = "critical" | "warning" | "info";

/** How urgent an alert is, the same word the resolve pop-up's tag shows. Weather is information. */
export function urgencyOf(alert: ClubAlert): Urgency {
  if (alert.kind === "weather") return "info";
  return alert.severity === "critical" ? "critical" : "warning";
}

export const urgencyMeta: Record<Urgency, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "var(--color-status-problem)", bg: "var(--color-attention-bg)" },
  warning: { label: "Warning", color: "var(--color-status-due)", bg: "#FBF1D6" },
  info: { label: "Info", color: "var(--color-slate)", bg: "var(--color-weather-bg)" },
};

/** The heading for each kind of alert: the situation. Shared by Next Steps and the resolve pop-up. */
export const alertHeadlines: Record<ClubAlert["kind"], string> = {
  due: "Reaching Capacity",
  sapAge: "Sap Spoiling",
  full: "Bucket Full",
  offline: "No Signal",
  tipped: "Weight Change",
  weather: "Weather Alert",
  sensor: "Sensor Error",
  battery: "Low Battery",
};

/** "Hard freeze forecast: low of 20°F" -> ["Hard freeze forecast", "Low of 20°F"] */
function splitWeather(title: string): [string, string] {
  const [head, ...rest] = title.split(": ");
  const tail = rest.join(": ");
  return [head ?? title, tail ? tail[0]!.toUpperCase() + tail.slice(1) : ""];
}

/** The situation, for a list: "Sap Spoiling". Weather names its own ("Hard freeze forecast"). */
export function alertHeadline(alert: ClubAlert): string {
  return alert.kind === "weather" ? splitWeather(alert.title)[0] : alertHeadlines[alert.kind];
}

/** "164 hours" up to two days, then "6 days, 20 hours" */
function waited(hours: number): string {
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  const left = hours % 24;
  return `${days} days${left ? `, ${left} hour${left === 1 ? "" : "s"}` : ""}`;
}

/**
 * One line under the headline saying which bucket and how bad: "Bucket #03 waiting for 6 days,
 * 20 hours". Falls back to the alert's own title when the station is not known.
 */
export function alertDetail(alert: ClubAlert, station?: StationView): string {
  if (alert.kind === "weather") return splitWeather(alert.title)[1] || alert.advice;
  if (!station) return alert.title;
  const name = station.name;
  const fill = Math.round(station.fillPercent);
  switch (alert.kind) {
    case "sapAge":
      return `${name} waiting for ${waited(station.sapAgeHours)}`;
    case "full":
      return `${name} is at ${fill}% of its target`;
    case "due":
      return `${name} is ${fill}% full`;
    case "offline":
      return `${name} silent since ${station.lastUpdated}`;
    case "battery":
      return `${name} battery at ${station.batteryLevel === null ? "—" : Math.round(station.batteryLevel)}%`;
    case "tipped": {
      const lost = /lost ([\d.]+) lbs/.exec(alert.context)?.[1];
      return lost ? `${name} dropped ${lost} lbs at once` : `${name} dropped suddenly`;
    }
    default:
      return alert.title;
  }
}

/**
 * The alert's own icon (clock, bucket, battery…). `urgency` colors it by how urgent it is, in a soft
 * tinted circle; without it the icon keeps its kind's color, as in the history tables.
 */
export default function AlertIcon({
  kind,
  size = 26,
  urgency,
}: {
  kind: AlertIconKind;
  size?: number;
  urgency?: Urgency;
}) {
  const { Icon, color } = iconFor[kind];
  if (urgency) {
    const meta = urgencyMeta[urgency];
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ color: meta.color, background: meta.bg, width: size + 14, height: size + 14 }}
        role="img"
        aria-label={meta.label}
      >
        <Icon size={size} />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center justify-center" style={{ color }}>
      <Icon size={size} />
    </span>
  );
}
