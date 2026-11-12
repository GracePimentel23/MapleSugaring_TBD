import {
  BatteryIcon,
  ClockIcon,
  DropIcon,
  FullIcon,
  SignalOffIcon,
  WrenchIcon,
} from "@/components/icons";
import { cx } from "@/components/ui/ui";
import { stationStatusMeta } from "@/lib/selectors/stations";
import type { StationStatus } from "@/lib/types/schema";

const statusIcon: Partial<Record<StationStatus, typeof ClockIcon>> = {
  due: ClockIcon,
  full: FullIcon,
  lowBattery: BatteryIcon,
  offline: SignalOffIcon,
  maintenance: WrenchIcon,
  emptying: DropIcon,
};

/**
 * A station's status as a tinted pill. Each status has its own icon as well as
 * its own color, so it reads without relying on color alone. `plain` drops the
 * icon where the word is enough (the station cards).
 */
export default function StatusBadge({
  status,
  size = "md",
  plain = false,
  label,
  className,
}: {
  status: StationStatus;
  /** A more specific word than the status's own (see stationStatusLabel) */
  label?: string;
  size?: "sm" | "md";
  plain?: boolean;
  className?: string;
}) {
  const meta = stationStatusMeta[status];
  const Icon = statusIcon[status];
  if (plain) {
    return (
      <span
        className={cx(
          "inline-flex shrink-0 items-center rounded-full font-sans font-semibold whitespace-nowrap",
          size === "sm" ? "px-2 py-0.5 text-[12px] md:text-sm" : "px-2.5 py-1 text-xs md:text-sm",
          className,
        )}
        style={{ color: meta.color, background: meta.bg }}
      >
        {label ?? meta.label}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-sans font-semibold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[12px] md:text-sm" : "px-2.5 py-1 text-xs md:text-sm",
        className,
      )}
      style={{ color: meta.color, background: meta.bg }}
    >
      {Icon ? (
        <Icon size={size === "sm" ? 12 : 14} />
      ) : (
        <span className="relative flex h-2 w-2">
          {/* Filling: a soft pulse, like sap dripping in */}
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {label ?? meta.label}
    </span>
  );
}
