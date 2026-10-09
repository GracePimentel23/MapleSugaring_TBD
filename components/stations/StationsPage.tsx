"use client";

import { useEffect, useState } from "react";
import { WrenchIcon } from "@/components/icons";
import { AddStationModal, EditBucketModal } from "@/components/stations/StationForms";
import StationModal from "@/components/stations/StationModal";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { canManage, currentUser } from "@/lib/data/stationNotes";
import {
  alertWarning,
  cardProgressFill,
  needsAttention,
  stationStatusMeta,
} from "@/lib/selectors/stations";
import type { StationStatus, StationView } from "@/lib/types/schema";
import { formatLbsNumber } from "@/lib/units";

type TabFilter = "all" | StationStatus;

const tabs: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "online", label: "Online" },
  { id: "maintenance", label: "Maintenance" },
  { id: "offline", label: "Offline" },
];

/** How long a station stays highlighted after jumping to it from the bell. */
const FOCUS_HIGHLIGHT_MS = 2500;

function MaintenanceToggle({
  station,
  onToggle,
}: {
  station: StationView;
  onToggle: () => void;
}) {
  const on = station.inMaintenance;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Maintenance mode for ${station.name}`}
      title={on ? "Take out of maintenance" : "Put in maintenance"}
      onClick={(event) => {
        // The card itself opens bucket info; the toggle must not.
        event.stopPropagation();
        onToggle();
      }}
      className="h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors"
      style={{
        background: on ? "var(--color-status-attention)" : "var(--color-progress-track)",
      }}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm transition-transform"
        style={{
          transform: on ? "translateX(16px)" : "none",
          color: on ? "#1C1C1E" : "#9CA3AF",
        }}
      >
        <WrenchIcon />
      </span>
    </button>
  );
}

function StationCard({
  station,
  canToggleMaintenance,
  highlighted,
  onToggleMaintenance,
  onOpenDetails,
}: {
  station: StationView;
  canToggleMaintenance: boolean;
  highlighted: boolean;
  onToggleMaintenance: () => void;
  onOpenDetails: () => void;
}) {
  const inactive = station.status !== "online";
  const percent = Math.min(station.fillPercent, 100);
  const fill = cardProgressFill(station.status);
  const meta = stationStatusMeta[station.status];

  return (
    <article
      id={`station-${station.bucketId}`}
      onClick={onOpenDetails}
      className="group scroll-mt-6 cursor-pointer rounded-2xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: inactive ? "#ECEAE6" : "white",
        border: `1px solid ${inactive ? "#D9D6CF" : "var(--color-border)"}`,
        boxShadow: highlighted ? "0 0 0 3px rgba(245,158,11,0.55)" : undefined,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <button
          type="button"
          // The article handles the click; this keeps the card reachable by keyboard.
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetails();
          }}
          aria-label={`Open ${station.name} info`}
          className="-m-1.5 flex items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors group-hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-accent"
          style={{ opacity: inactive ? 0.55 : 1 }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 2C10 2 5 8 5 12a5 5 0 0010 0c0-4-5-10-5-10z" fill="#1C1C1E" />
          </svg>
          <div>
            <div className="font-sans text-sm leading-tight font-semibold">
              {station.name}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {station.location} · Updated {station.lastUpdated}
            </div>
          </div>
        </button>

        {canToggleMaintenance ? (
          <MaintenanceToggle station={station} onToggle={onToggleMaintenance} />
        ) : null}
      </div>

      {/* The status tag stays at full strength even when the rest of the card is greyed out */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ color: meta.color, background: meta.bg }}
        >
          <span style={{ fontSize: 7 }}>●</span>
          {meta.label}
        </span>
        <span
          className="text-xs font-medium"
          style={{
            color: inactive ? "var(--color-muted)" : "var(--color-accent)",
            opacity: inactive ? 0.7 : 1,
          }}
        >
          {Math.round(percent)}%
        </span>
      </div>

      <div style={{ opacity: inactive ? 0.55 : 1 }}>
        <div
          className="h-2 overflow-hidden rounded-full"
          style={{ background: "var(--color-progress-track)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, background: fill }}
          />
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-muted" style={{ opacity: inactive ? 0.7 : 1 }}>
          <span className="font-semibold text-text">{formatLbsNumber(station.currentLbs)}</span>
          {" / "}
          {formatLbsNumber(station.capacityLbs)} lbs
        </span>
      </div>

      {station.isOffline ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          <span className="font-bold">!</span>
          <span>Please check station. Hardware error.</span>
        </div>
      ) : (
        station.alerts.map((alert) => (
          <div
            key={alert.id}
            className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
          >
            <span className="font-bold">!</span>
            <span>{alertWarning(alert, station)}</span>
          </div>
        ))
      )}
    </article>
  );
}

export default function StationsPage() {
  const stations = useStationCards();
  const { toggleMaintenance, focusedBucketId, clearFocus } = useStationState();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editBucketId, setEditBucketId] = useState<number | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const [handledFocus, setHandledFocus] = useState<number | null>(null);
  const isAdmin = true;
  const canToggle = canManage(currentUser.role);

  // Arriving from a notification: make sure the station is in view by showing
  // every station, then scroll to it and flash a highlight.
  if (focusedBucketId !== handledFocus) {
    setHandledFocus(focusedBucketId);
    if (focusedBucketId !== null) setActiveTab("all");
  }

  useEffect(() => {
    if (focusedBucketId === null) return;
    document
      .getElementById(`station-${focusedBucketId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(clearFocus, FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [focusedBucketId, clearFocus]);

  const attentionCount = stations.filter(needsAttention).length;
  const counts: Record<TabFilter, number> = {
    all: stations.length,
    online: stations.filter((station) => station.status === "online").length,
    maintenance: stations.filter((station) => station.status === "maintenance").length,
    offline: stations.filter((station) => station.status === "offline").length,
  };

  // Stations that need attention come first; otherwise keep bucket order.
  const filtered = stations
    .filter((station) => activeTab === "all" || station.status === activeTab)
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));

  // Resolved from the current day, so an open modal follows the replay instead
  // of holding a stale snapshot.
  const detailStation = stations.find((station) => station.bucketId === details) ?? null;
  const editStation = stations.find((station) => station.bucketId === editBucketId) ?? null;

  return (
    <div className="min-h-full w-full p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-semibold md:text-3xl">Stations</h1>
          <p className="mt-0.5 text-sm text-muted">
            {counts.online} online · {attentionCount} need
            {attentionCount === 1 ? "s" : ""} attention
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            <span className="text-base leading-none">+</span> Add Station
          </button>
        ) : null}
      </div>

      <div className="mb-5 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pt-1.5 pr-1.5 pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-sans text-sm font-medium whitespace-nowrap transition-all"
                style={{
                  background: active ? "var(--color-accent)" : "white",
                  color: active ? "#fff" : "var(--color-muted)",
                  border: active
                    ? "1.5px solid var(--color-accent)"
                    : "1.5px solid var(--color-border)",
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
                  {counts[tab.id]}
                </span>
                {tab.id === "all" && attentionCount > 0 ? (
                  <span
                    className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-amber-950"
                    style={{ background: "var(--color-status-attention)" }}
                    aria-label={`${attentionCount} stations need attention`}
                  >
                    {attentionCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted">
          <div className="mb-3 text-4xl">🍁</div>
          <p className="text-sm font-medium">No stations in this category</p>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((station) => (
            <StationCard
              key={station.bucketId}
              station={station}
              canToggleMaintenance={canToggle}
              highlighted={focusedBucketId === station.bucketId}
              onToggleMaintenance={() => toggleMaintenance(station.bucketId)}
              onOpenDetails={() => setDetails(station.bucketId)}
            />
          ))}
        </div>
      )}

      {showAdd ? <AddStationModal onClose={() => setShowAdd(false)} /> : null}
      {editStation ? (
        <EditBucketModal station={editStation} onClose={() => setEditBucketId(null)} />
      ) : null}
      {detailStation && !editStation ? (
        <StationModal
          station={detailStation}
          onClose={() => setDetails(null)}
          onEdit={
            isAdmin
              ? () => {
                  setEditBucketId(detailStation.bucketId);
                  setDetails(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
