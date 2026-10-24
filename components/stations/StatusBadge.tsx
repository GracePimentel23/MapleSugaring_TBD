import {
  BatteryIcon,
  ClockIcon,
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
};

/**
 * A station's status as a tinted pill. Each status has its own icon as well as
 * its own color, so it reads without relying on color alone.
 */
export default function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: StationStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = stationStatusMeta[status];
  const Icon = statusIcon[status];
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
      {meta.label}
    </span>
  );
}
