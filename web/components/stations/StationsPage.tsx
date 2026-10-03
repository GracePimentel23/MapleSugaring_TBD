"use client";

import { useState } from "react";
import { useShows } from "@/components/auth/AccessContext";
import LiveRefresh from "@/components/common/LiveRefresh";
import AddStationModal from "@/components/stations/AddStationModal";
import EditBucketModal from "@/components/stations/EditBucketModal";
import StationCard from "@/components/stations/StationCard";
import StationDetailsModal from "@/components/stations/StationDetailsModal";
import { EditIcon } from "@/components/ui/icons";
import type { DataSource } from "@/lib/data/source";
import type { Alert, StationDisplayStatus, StationView } from "@/lib/types/schema";

type TabFilter = "all" | StationDisplayStatus;

const tabs: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "complete", label: "Complete" },
  { id: "in_progress", label: "In Progress" },
  { id: "offline", label: "Offline" },
];

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
        <StationDetailsModal
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
