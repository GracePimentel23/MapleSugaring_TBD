"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import StationModal from "@/components/stations/StationModal";
import {
  cardProgressFill,
  getStationCards,
  getUnresolvedAlertsForNode,
} from "@/lib/selectors/stations";
import type { StationDisplayStatus, StationView } from "@/lib/types/schema";
import { formatLbsNumber } from "@/lib/units";

type TabFilter = "all" | StationDisplayStatus;

const tabs: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "complete", label: "Complete" },
  { id: "in_progress", label: "In Progress" },
  { id: "offline", label: "Offline" },
];

const displayMeta: Record<
  StationDisplayStatus,
  { label: string; color: string; bg: string }
> = {
  complete: { label: "Complete", color: "#16A34A", bg: "rgba(34,197,94,0.12)" },
  in_progress: { label: "In Progress", color: "#2563EB", bg: "rgba(59,130,246,0.12)" },
  offline: { label: "Offline", color: "#DC2626", bg: "rgba(239,68,68,0.12)" },
};

const statusOptions: { value: StationDisplayStatus; label: string }[] = [
  { value: "complete", label: "Complete" },
  { value: "in_progress", label: "In Progress" },
  { value: "offline", label: "Offline" },
];

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StatusChip({
  station,
  isAdmin,
  onStatusChange,
}: {
  station: StationView;
  isAdmin: boolean;
  onStatusChange: (bucketId: number, status: StationDisplayStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = displayMeta[station.displayStatus];

  if (!isAdmin) {
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: meta.color, background: meta.bg }}
      >
        <span style={{ fontSize: 7 }}>●</span>
        {meta.label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{ marginLeft: 1 }}
          aria-hidden="true"
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close status menu"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className="absolute top-full right-0 z-20 mt-1 min-w-[130px] rounded-xl bg-white py-1 shadow-lg"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onStatusChange(station.bucketId, option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
                style={{ color: displayMeta[option.value].color }}
              >
                <span style={{ fontSize: 7 }}>●</span>
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StationCard({
  station,
  isAdmin,
  onStatusChange,
  onOpenDetails,
}: {
  station: StationView;
  isAdmin: boolean;
  onStatusChange: (bucketId: number, status: StationDisplayStatus) => void;
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

        <StatusChip station={station} isAdmin={isAdmin} onStatusChange={onStatusChange} />
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

function AddStationModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-sans text-base font-semibold">Add Station</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-3">
          {[
            { label: "Bucket Name", placeholder: "e.g. Bucket #06", type: "text" },
            { label: "Location", placeholder: "e.g. East Slope", type: "text" },
            { label: "Target Weight (lbs)", placeholder: "12", type: "number" },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-xs font-medium text-muted">
                {field.label}
              </label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 font-sans text-sm font-semibold"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Add Station
          </button>
        </div>
      </div>
    </div>
  );
}

function EditBucketModal({
  station,
  onClose,
}: {
  station: StationView;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-sans text-base font-semibold">Edit Bucket</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-3">
          {[
            { label: "Bucket Name", value: station.name, type: "text" },
            { label: "Location", value: station.location, type: "text" },
            { label: "Target Weight (lbs)", value: station.capacityLbs, type: "number" },
            { label: "Current Weight (lbs)", value: station.currentLbs, type: "number" },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-xs font-medium text-muted">
                {field.label}
              </label>
              <input
                type={field.type}
                defaultValue={field.value}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 font-sans text-sm font-semibold"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

interface StatusOverride {
  displayStatus: StationDisplayStatus;
  currentLbs?: number;
  fillPercent?: number;
}

export default function StationsPage() {
  const { day, dayIndex } = useDemo();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editBucketId, setEditBucketId] = useState<number | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<string, StatusOverride>>({});
  const isAdmin = true;

  // Manual status changes are a presenter convenience only. Keying them by day
  // means stepping the demo forward hands control back to the timeline without
  // having to clear anything.
  const stations = getStationCards(day).map((station) => {
    const override = overrides[`${dayIndex}:${station.bucketId}`];
    if (!override) return station;

    return {
      ...station,
      displayStatus: override.displayStatus,
      currentLbs: override.currentLbs ?? station.currentLbs,
      fillPercent: override.fillPercent ?? station.fillPercent,
    };
  });

  function handleStatusChange(bucketId: number, status: StationDisplayStatus) {
    const station = stations.find((item) => item.bucketId === bucketId);
    setOverrides((current) => ({
      ...current,
      [`${dayIndex}:${bucketId}`]:
        status === "complete" && station
          ? {
              displayStatus: status,
              currentLbs: station.capacityLbs,
              fillPercent: 100,
            }
          : { displayStatus: status },
    }));
  }

  const counts: Record<TabFilter, number> = {
    all: stations.length,
    complete: stations.filter((station) => station.displayStatus === "complete").length,
    in_progress: stations.filter((station) => station.displayStatus === "in_progress")
      .length,
    offline: stations.filter((station) => station.displayStatus === "offline").length,
  };

  const filtered = stations.filter((station) =>
    activeTab === "all" ? true : station.displayStatus === activeTab,
  );

  // Resolved from the current day, so an open modal or edit sheet follows the
  // replay instead of holding a stale snapshot.
  const detailStation = stations.find((station) => station.bucketId === details) ?? null;
  const editStation =
    stations.find((station) => station.bucketId === editBucketId) ?? null;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-semibold md:text-3xl">Stations</h1>
          <p className="mt-0.5 text-sm text-muted">
            {counts.complete + counts.in_progress} active · {counts.offline} offline
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
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-sans text-sm font-medium whitespace-nowrap transition-all"
                style={{
                  background: active ? "var(--color-accent)" : "white",
                  color: active ? "#fff" : "var(--color-muted)",
                  border: active ? "none" : "1.5px solid var(--color-border)",
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((station) => (
            <div key={station.bucketId} className="group relative">
              <StationCard
                station={station}
                isAdmin={isAdmin}
                onStatusChange={handleStatusChange}
                onOpenDetails={() => setDetails(station.bucketId)}
              />
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setEditBucketId(station.bucketId)}
                  className="absolute right-3 bottom-3 flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 font-sans text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-50"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}
                >
                  <EditIcon />
                  Edit Bucket
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {showAdd ? <AddStationModal onClose={() => setShowAdd(false)} /> : null}
      {editStation ? (
        <EditBucketModal station={editStation} onClose={() => setEditBucketId(null)} />
      ) : null}
      {detailStation ? (
        <StationModal
          station={detailStation}
          alerts={getUnresolvedAlertsForNode(day, detailStation.nodeId)}
          onClose={() => setDetails(null)}
        />
      ) : null}
    </div>
  );
}
