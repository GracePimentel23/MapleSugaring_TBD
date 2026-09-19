"use client";

import { useState } from "react";
import { DropletIcon } from "@/components/icons";
import StationModal from "@/components/stations/StationModal";
import { getStationSummary, progressFill } from "@/lib/selectors/stations";
import { formatLbsNumber } from "@/lib/units";
import type { StationUiStatus, StationView } from "@/lib/types/schema";

type TabFilter = "all" | "online" | "attention" | "offline";

const tabs: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "online", label: "Complete" },
  { id: "attention", label: "Needs Attention" },
  { id: "offline", label: "Offline" },
];

const statusColor: Record<StationUiStatus, string> = {
  online: "var(--color-status-online)",
  attention: "var(--color-status-attention)",
  offline: "var(--color-status-offline)",
};

const statusLabel: Record<StationUiStatus, string> = {
  online: "Complete",
  attention: "Needs Attention",
  offline: "Offline",
};

const progressColor: Record<StationUiStatus, string> = {
  online: "var(--color-accent)",
  attention: "var(--color-status-attention)",
  offline: "var(--color-status-offline)",
};

function StationCard({
  station,
  onClick,
}: {
  station: StationView;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-border bg-white p-4 text-left shadow-[0_1px_2px_rgba(28,28,30,0.04)] transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <DropletIcon fill="#1C1C1E" size={16} />
          <div>
            <div className="font-sans text-sm leading-tight font-semibold">{station.name}</div>
            <div className="mt-0.5 text-xs text-muted">Updated at {station.lastUpdated}</div>
          </div>
        </div>
        <span
          className="flex shrink-0 items-center gap-1 text-xs font-medium"
          style={{ color: statusColor[station.status] }}
        >
          <span className="text-[8px]">●</span>
          {statusLabel[station.status]}
        </span>
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-progress-track">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(station.fillPercent, 100)}%`,
              background: progressFill(station.status),
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs text-muted">
            <span className="font-semibold text-text">{formatLbsNumber(station.currentLbs)}</span>
            {" lbs / "}
            {formatLbsNumber(station.capacityLbs)} lbs
          </span>
          <span className="text-xs font-medium" style={{ color: progressColor[station.status] }}>
            {Math.round(station.fillPercent)}%
          </span>
        </div>
      </div>
    </button>
  );
}

export default function StationsPage() {
  const { stations, summaryLabel } = getStationSummary();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [selected, setSelected] = useState<StationView | null>(null);

  const filtered = stations.filter((station) => {
    if (activeTab === "all") return true;
    return station.status === activeTab;
  });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="font-sans text-2xl font-semibold md:text-3xl">Stations</h1>
        <p className="mt-0.5 text-sm text-muted">{summaryLabel}</p>
      </div>

      <div className="mb-5 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const count =
              tab.id === "all"
                ? stations.length
                : stations.filter((station) => station.status === tab.id).length;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all"
                style={{
                  background: active ? "var(--color-accent)" : "white",
                  color: active ? "#fff" : "var(--color-muted)",
                  border: active ? "none" : "1.5px solid var(--color-border)",
                  fontFamily: "var(--font-dm-sans), sans-serif",
                }}
              >
                {tab.label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: active ? "rgba(255,255,255,0.25)" : "var(--color-bg)",
                    color: active ? "#fff" : "var(--color-muted)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted">
          <p className="text-sm font-medium">No stations in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((station) => (
            <StationCard
              key={station.bucketId}
              station={station}
              onClick={() => setSelected(station)}
            />
          ))}
        </div>
      )}

      {selected ? <StationModal station={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
