"use client";

import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import StatusBadge from "@/components/stations/StatusBadge";
import { cx, ProgressBar } from "@/components/ui/ui";
import { stationStatusMeta } from "@/lib/selectors/stations";
import type { StationView } from "@/lib/types/schema";

/** Compact station card for the Dashboard. Opens the station pop-up. */
export default function StationTile({
  station,
  onOpen,
}: {
  station: StationView;
  onOpen: () => void;
}) {
  const { weight } = useClubSettings();
  const meta = stationStatusMeta[station.status];
  const inactive = station.status === "maintenance" || station.status === "offline";
  const percent = Math.round(Math.min(station.fillPercent, 100));

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "flex flex-col rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
        inactive ? "border-[#DAD9D1] bg-[#EFEFE9]" : "border-border bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-sans text-lg font-semibold">{station.name}</span>
        <StatusBadge status={station.status} />
      </div>
      <span className="mt-1 text-[15px] text-muted">{station.location}</span>
      <div className={cx("mt-4 mb-3", inactive && "opacity-60")}>
        <span className="font-sans text-3xl font-bold">{weight(station.currentLbs, false, true)}</span>
        <span className="ml-1.5 text-[15px] text-muted">/ {weight(station.capacityLbs)}</span>
      </div>
      <div className={cx(inactive && "opacity-60")}>
        <ProgressBar percent={percent} color={meta.bar} height={10} />
      </div>
      <p className="mt-3 text-[15px] text-muted">
        {percent}% full · Last reading {station.lastUpdated}
      </p>
    </button>
  );
}
