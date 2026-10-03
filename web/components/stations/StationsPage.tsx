"use client";

import { useState } from "react";
import { useShows } from "@/components/auth/Access";
import LiveRefresh from "@/components/common/LiveRefresh";
import { useFormSubmit } from "@/components/common/useFormSubmit";
import StationModal from "@/components/stations/StationModal";
import { cardProgressFill } from "@/lib/selectors/stations";
import type { DataSource } from "@/lib/data/source";
import type { Alert, StationDisplayStatus, StationView } from "@/lib/types/schema";
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

function StationCard({
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

function AddStationModal({ onClose }: { onClose: () => void }) {
  const { onSubmit, error, saving } = useFormSubmit(onClose, (values) => ({
    method: "POST",
    path: "/stations",
    body: {
      name: values.name,
      location: values.location,
      capacityLbs: values.capacityLbs,
      nodeCode: values.nodeCode,
    },
  }));

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
        <form onSubmit={onSubmit}>
        <div className="space-y-3">
          {[
            { name: "name", label: "Bucket Name", placeholder: "e.g. Bucket #06", type: "text" },
            { name: "location", label: "Location", placeholder: "e.g. East Slope", type: "text" },
            { name: "capacityLbs", label: "Target Weight (lbs)", placeholder: "12", type: "number" },
            { name: "nodeCode", label: "Sensor ID (optional)", placeholder: "e.g. LC02", type: "text" },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-xs font-medium text-muted">
                {field.label}
              </label>
              <input
                name={field.name}
                type={field.type}
                step={field.type === "number" ? "any" : undefined}
                required={field.name === "name"}
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
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            Add Station
          </button>
        </div>
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </form>
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
  const { onSubmit, error, saving } = useFormSubmit(onClose, (values) => ({
    method: "PATCH",
    path: `/stations/${station.bucketId}`,
    body: { name: values.name, location: values.location, capacityLbs: values.capacityLbs },
  }));
  const location = (station as StationView & { location?: string | null }).location ?? "";

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
        <form onSubmit={onSubmit}>
        <div className="space-y-3">
          {[
            { name: "name", label: "Bucket Name", value: station.name, type: "text" },
            { name: "location", label: "Location", value: location, type: "text" },
            { name: "capacityLbs", label: "Target Weight (lbs)", value: station.capacityLbs, type: "number" },
            { name: "currentLbs", label: "Current Weight (lbs, from the sensor)", value: station.currentLbs, type: "number" },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-xs font-medium text-muted">
                {field.label}
              </label>
              <input
                name={field.name}
                type={field.type}
                step={field.type === "number" ? "any" : undefined}
                readOnly={field.name === "currentLbs"}
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
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            Save Changes
          </button>
        </div>
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}

export default function StationsPage({
  stations,
  alerts,
  source,
}: {
  stations: StationView[];
  alerts: Alert[];
  source: DataSource;
}) {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editBucketId, setEditBucketId] = useState<number | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  // Who sees "Add station" and the edit pencil: worker/src/rbac.config.js COMPONENTS.
  const isAdmin = useShows("stations.manage");

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

  const detailStation = stations.find((station) => station.bucketId === details) ?? null;
  const editStation =
    stations.find((station) => station.bucketId === editBucketId) ?? null;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-sans text-2xl font-semibold md:text-3xl">Stations</h1>
            <LiveRefresh source={source} />
          </div>
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
          alerts={alerts.filter(
            (alert) => !alert.is_resolved && alert.node_id === detailStation.nodeId,
          )}
          onClose={() => setDetails(null)}
        />
      ) : null}
    </div>
  );
}
