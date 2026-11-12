"use client";

import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import StatusBadge from "@/components/stations/StatusBadge";
import { cx, ProgressBar } from "@/components/ui/ui";
import { stationStatusLabel, stationStatusMeta } from "@/lib/selectors/stations";
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
        "flex flex-col rounded-2xl p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
        inactive ? "bg-[#EFEFE9]" : "bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-sans text-base font-semibold">{station.name}</span>
        <StatusBadge status={station.status} label={stationStatusLabel(station)} />
      </div>
      <span className="mt-1 text-sm text-muted">{station.location}</span>
      <div className={cx("mt-4 mb-3", inactive && "opacity-60")}>
        <span className="font-sans text-2xl font-semibold">{weight(station.currentLbs, false, true)}</span>
        <span className="ml-1.5 text-sm text-muted">/ {weight(station.capacityLbs)}</span>
      </div>
      <div className={cx(inactive && "opacity-60")}>
        <ProgressBar percent={percent} color={meta.bar} height={10} filling />
      </div>
      <p className="mt-3 text-sm text-muted">
        {percent}% full · Last reading {station.lastUpdated}
      </p>
    </button>
  );
}
