import {
  BatteryIcon,
  ClockIcon,
  CloudIcon,
  FullIcon,
  PauseIcon,
  SignalOffIcon,
} from "@/components/icons";
import type { AlertKind } from "@/lib/types/schema";

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

export default function AlertIcon({ kind, size = 26 }: { kind: AlertIconKind; size?: number }) {
  const { Icon, color } = iconFor[kind];
  return (
    <span className="flex shrink-0 items-center justify-center" style={{ color }}>
      <Icon size={size} />
    </span>
  );
}
