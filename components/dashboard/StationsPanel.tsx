import Link from "next/link";
import { panelProgressFill } from "@/lib/selectors/stations";
import type { StationUiStatus, StationView } from "@/lib/types/schema";
import { formatLbsNumber } from "@/lib/units";

const statusColor: Record<StationUiStatus, string> = {
  online: "var(--color-status-online)",
  attention: "var(--color-status-attention)",
  offline: "var(--color-status-offline)",
};

const statusLabel: Record<StationUiStatus, string> = {
  online: "Online",
  attention: "Attention",
  offline: "Offline",
};

export default function StationsPanel({
  stations,
  summaryLabel,
}: {
  stations: StationView[];
  summaryLabel: string;
}) {
  return (
    <aside className="hidden shrink-0 flex-col lg:flex" style={{ width: 333 }}>
      <div
        className="overflow-hidden rounded-2xl bg-white shadow-sm"
        style={{
          border: "1px solid var(--color-border)",
          width: 333,
          height: 650,
          maxHeight: "100%",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3.5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div>
            <h2 className="font-sans text-sm font-semibold">Stations</h2>
            <p className="mt-0.5 text-xs text-muted">{summaryLabel}</p>
          </div>
          <Link href="/stations" className="text-xs font-medium text-accent">
            See all
          </Link>
        </div>

        <div className="flex flex-col divide-y divide-border overflow-y-auto">
          {stations.map((station) => (
            <div key={station.bucketId} className="px-4 py-3.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "var(--color-accent-light)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M10 2C10 2 5 8 5 12a5 5 0 0010 0c0-4-5-10-5-10z"
                        fill="var(--color-accent)"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-sans text-xs leading-tight font-semibold">
                      {station.name}
                    </div>
                    <div className="text-muted" style={{ fontSize: 10 }}>
                      Updated {station.lastUpdated}
                    </div>
                  </div>
                </div>
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: statusColor[station.status] }}
                >
                  <span style={{ fontSize: 7 }}>●</span>
                  {statusLabel[station.status]}
                </span>
              </div>

              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: "var(--color-progress-track)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(station.fillPercent, 100)}%`,
                    background: panelProgressFill(station.status),
                  }}
                />
              </div>
              <div className="mt-1 text-xs text-muted">
                <span className="font-semibold text-text">
                  {formatLbsNumber(station.currentLbs)}
                </span>
                {" / "}
                {formatLbsNumber(station.capacityLbs)} lbs
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
