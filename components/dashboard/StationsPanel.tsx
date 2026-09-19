import Link from "next/link";
import { DropletIcon } from "@/components/icons";
import { formatFillLabel, progressFill } from "@/lib/selectors/stations";
import type { StationUiStatus, StationView } from "@/lib/types/schema";

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
    <aside className="hidden w-[280px] shrink-0 lg:flex">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(28,28,30,0.04)]">
        <div className="px-5 pt-4 pb-3">
          <h2 className="font-sans text-base font-semibold">Stations</h2>
          <p className="mt-0.5 text-xs text-muted">{summaryLabel}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {stations.map((station) => (
            <div key={station.bucketId} className="px-5 py-3.5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <DropletIcon fill="#1C1C1E" size={16} />
                  <div>
                    <div className="font-sans text-sm leading-tight font-semibold">
                      {station.name}
                    </div>
                    <div className="text-[11px] text-muted">
                      Updated at {station.lastUpdated}
                    </div>
                  </div>
                </div>
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: statusColor[station.status] }}
                >
                  <span className="text-[8px]">●</span>
                  {statusLabel[station.status]}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-progress-track">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(station.fillPercent, 100)}%`,
                    background: progressFill(station.status),
                  }}
                />
              </div>
              <div className="mt-1.5 text-xs text-muted">{formatFillLabel(station)}</div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 text-center">
          <Link
            href="/stations"
            className="font-sans text-sm font-medium text-accent hover:underline"
          >
            See All Stations
          </Link>
        </div>
      </div>
    </aside>
  );
}
