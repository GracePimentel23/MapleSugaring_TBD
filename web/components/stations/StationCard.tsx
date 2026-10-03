"use client";

import { cardProgressFill } from "@/lib/selectors/stations";
import type { StationDisplayStatus, StationView } from "@/lib/types/schema";
import { formatLbsNumber } from "@/lib/units";

const displayMeta: Record<
  StationDisplayStatus,
  { label: string; color: string; bg: string }
> = {
  complete: { label: "Complete", color: "#16A34A", bg: "rgba(34,197,94,0.12)" },
  in_progress: { label: "In Progress", color: "#2563EB", bg: "rgba(59,130,246,0.12)" },
  offline: { label: "Offline", color: "#DC2626", bg: "rgba(239,68,68,0.12)" },
};

function StatusChip({ station }: { station: StationView }) {
  const meta = displayMeta[station.displayStatus];

  return (
    <span
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: meta.color, background: meta.bg }}
    >
      <span style={{ fontSize: 7 }}>●</span>
      {meta.label}
    </span>
  );
}

export default function StationCard({
  station,
  onOpenDetails,
}: {
  station: StationView;
  onOpenDetails: () => void;
}) {
  const isOffline = station.displayStatus === "offline";
  const percent = Math.min(station.fillPercent, 100);
  const fill = cardProgressFill(station.displayStatus);

  return (
    <div
      className="rounded-2xl bg-white p-4 shadow-sm"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <div className="mb-2.5 flex items-start justify-between">
        <button
          type="button"
          onClick={onOpenDetails}
          className="flex items-center gap-2.5 text-left transition-opacity"
          style={{ opacity: isOffline ? 0.45 : 1 }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 2C10 2 5 8 5 12a5 5 0 0010 0c0-4-5-10-5-10z" fill="#1C1C1E" />
          </svg>
          <div>
            <div className="font-sans text-sm leading-tight font-semibold">
              {station.name}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              Updated {station.lastUpdated}
            </div>
          </div>
        </button>

        <StatusChip station={station} />
      </div>

      <div style={{ opacity: isOffline ? 0.45 : 1 }}>
        <div
          className="h-2 overflow-hidden rounded-full"
          style={{ background: "var(--color-progress-track)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, background: fill }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs text-muted">
            <span className="font-semibold text-text">
              {formatLbsNumber(station.currentLbs)}
            </span>
            {" / "}
            {formatLbsNumber(station.capacityLbs)} lbs
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: isOffline ? "#9CA3AF" : fill }}
          >
            {Math.round(percent)}%
          </span>
        </div>
      </div>
    </div>
  );
}
