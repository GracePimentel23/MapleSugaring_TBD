"use client";

import { useEffect, useState } from "react";
import { DropIcon, FilterIcon, InfoIcon, PlusIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { AddStationModal } from "@/components/stations/StationForms";
import StationDialogs from "@/components/stations/StationSheet";
import StationsMap from "@/components/stations/StationsMap";
import StatusBadge from "@/components/stations/StatusBadge";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { Button, Card, cx, EmptyState, FilterPill, PageHeader, ProgressBar, Toggle } from "@/components/ui/ui";
import {
  byUrgency,
  getStationSummary,
  matchesFilter,
  stationStatusMeta,
  type StationFilter,
} from "@/lib/selectors/stations";
import type { StationView } from "@/lib/types/schema";

const filters: { id: StationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "filling", label: "Filling" },
  { id: "due", label: "Due" },
  { id: "problems", label: "Problems" },
  { id: "maintenance", label: "Maintenance" },
];

/** How long a station stays highlighted after jumping to it from an alert. */
const FOCUS_HIGHLIGHT_MS = 2500;

/** "North Grove, tree 2" -> "North Grove · tree 2" */
function treeLine(station: StationView): string {
  return station.treeLabel.replace(", ", " · ");
}

function StationCard({
  station,
  highlighted,
  onOpen,
}: {
  station: StationView;
  highlighted: boolean;
  onOpen: () => void;
}) {
  const { can } = useSession();
  const { weight } = useClubSettings();
  const { toggleMaintenance } = useStationState();
  const meta = stationStatusMeta[station.status];
  const percent = Math.round(Math.min(station.fillPercent, 100));
  const inactive = station.status === "maintenance" || station.status === "offline";

  return (
    <article
      id={`station-${station.bucketId}`}
      onClick={onOpen}
      className={cx(
        "group scroll-mt-6 cursor-pointer rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
        inactive ? "border-[#DAD9D1] bg-[#EFEFE9]" : "border-border bg-white",
      )}
      style={{ boxShadow: highlighted ? "0 0 0 3px rgba(223,168,0,0.55)" : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="text-left font-sans text-lg font-semibold focus-visible:underline focus-visible:outline-none"
        >
          {station.name}
        </button>
        {/* The status stays at full strength even when the card is greyed out */}
        <StatusBadge status={station.status} />
      </div>
      <p className="text-sm text-muted">{treeLine(station)}</p>

      <div className={cx(inactive && "opacity-60")}>
        <div className="mt-4 mb-2">
          <span className="font-sans text-3xl font-bold">{weight(station.currentLbs, false, true)}</span>
          <span className="ml-1.5 text-sm text-muted">
            / {weight(station.capacityLbs)} · {percent}%
          </span>
        </div>
        <ProgressBar percent={percent} color={meta.bar} height={8} />
        <div className="mt-4 flex gap-6 text-sm text-muted">
          <span>Sap age {station.sapAgeHours} h</span>
          <span>Battery {Math.round(station.batteryLevel)}%</span>
        </div>
        <p className="mt-3 text-sm text-muted">Last reading {station.lastUpdated}</p>
      </div>

      {can("stations:maintenance") ? (
        <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
          <Toggle
            checked={station.inMaintenance}
            onChange={() => toggleMaintenance(station.bucketId)}
            label={`Maintenance mode for ${station.name}`}
            disabled={!can("stations:maintenance")}
          />
          <span className="text-sm text-muted">
            Maintenance mode {can("stations:maintenance") ? "(Manager)" : "(Manager only)"}
          </span>
        </div>
      ) : null}
    </article>
  );
}

function StatusLegend() {
  const items: [string, string][] = [
    ["Filling", "Collecting sap normally."],
    ["Due", "Nearly full, or the sap has waited too long. Collect it."],
    ["Full", "At the full mark. Empty it now."],
    ["Low battery", "Replace the sensor battery soon."],
    ["No signal", "The sensor stopped reporting. Check the hardware."],
    ["Maintenance", "Alerts are paused while someone services it."],
  ];
  return (
    <div className="absolute top-full right-0 z-30 mt-2 w-72 rounded-2xl border border-border bg-white p-4 text-left shadow-xl">
      <p className="mb-2 font-sans text-sm font-semibold">What the statuses mean</p>
      <dl className="space-y-1.5 text-sm">
        {items.map(([term, text]) => (
          <div key={term}>
            <dt className="inline font-semibold">{term}: </dt>
            <dd className="inline text-muted">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function StationsPage() {
  const stations = useStationCards();
  const { can } = useSession();
  const { focusedBucketId, clearFocus } = useStationState();
  const [filter, setFilter] = useState<StationFilter>("all");
  const [urgentFirst, setUrgentFirst] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [openBucket, setOpenBucket] = useState<number | null>(null);
  const [handledFocus, setHandledFocus] = useState<number | null>(null);

  // Arriving from an alert: show every station, then scroll to it and flash it.
  if (focusedBucketId !== handledFocus) {
    setHandledFocus(focusedBucketId);
    if (focusedBucketId !== null) setFilter("all");
  }

  useEffect(() => {
    if (focusedBucketId === null) return;
    document
      .getElementById(`station-${focusedBucketId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(clearFocus, FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [focusedBucketId, clearFocus]);

  const { onlineCount, attentionCount } = getStationSummary(stations);
  const counts = Object.fromEntries(
    filters.map((item) => [item.id, stations.filter((station) => matchesFilter(station, item.id)).length]),
  ) as Record<StationFilter, number>;

  const visible = stations.filter((station) => matchesFilter(station, filter));
  const sorted = urgentFirst ? [...visible].sort(byUrgency) : visible;
  const byBucket = [...stations].sort(byUrgency);

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <PageHeader
        title="Stations"
        subtitle={`${onlineCount} online · ${attentionCount} need${attentionCount === 1 ? "s" : ""} attention`}
        actions={
          can("stations:manage") ? (
            <Button onClick={() => setShowAdd(true)}>
              <PlusIcon size={16} />
              Add Station
            </Button>
          ) : null
        }
      />

      <div className="mb-6 flex items-center gap-3">
        <div className="no-scrollbar -mx-4 flex flex-1 gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
          {filters.map((item) => (
            <FilterPill
              key={item.id}
              label={item.label}
              count={counts[item.id]}
              active={filter === item.id}
              onClick={() => setFilter(item.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => setUrgentFirst(!urgentFirst)}
            aria-pressed={urgentFirst}
            title={urgentFirst ? "Sorted: most urgent first" : "Sorted: bucket order"}
            className={cx(
              "shrink-0 rounded-full p-2 transition-colors hover:bg-white",
              urgentFirst ? "text-accent" : "text-muted",
            )}
          >
            <FilterIcon size={20} />
          </button>
        </div>
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            aria-label="What the statuses mean"
            aria-expanded={showLegend}
            className="rounded-full p-2 text-muted transition-colors hover:bg-white hover:text-text"
          >
            <InfoIcon size={20} />
          </button>
          {showLegend ? <StatusLegend /> : null}
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<DropIcon size={26} />}
          title="No stations here"
          description="No station is in this group right now. Try All."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((station) => (
            <StationCard
              key={station.bucketId}
              station={station}
              highlighted={focusedBucketId === station.bucketId}
              onOpen={() => setOpenBucket(station.bucketId)}
            />
          ))}
        </div>
      )}

      <hr className="my-10 border-border" />

      <h2 className="font-sans text-2xl font-bold">Sugarbush Map</h2>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-muted">
        Where each bucket sits around the Lobozzo Alumni House. Ring color shows its status. Drag to move, tap
        a pin to open that station.
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Card className="p-4">
          <StationsMap
            stations={visible}
            highlightedId={focusedBucketId}
            onSelect={(bucketId) => setOpenBucket(bucketId)}
          />
        </Card>

        <section className="self-start overflow-hidden rounded-2xl border border-accent bg-white shadow-sm">
          <div className="flex items-baseline justify-between bg-accent px-5 py-4 text-white">
            <h3 className="font-sans text-lg font-bold">By Bucket</h3>
            <span className="text-sm text-white/80">most urgent first</span>
          </div>
          <ul className="divide-y divide-border">
            {byBucket.map((station) => {
              const meta = stationStatusMeta[station.status];
              const percent = Math.round(Math.min(station.fillPercent, 100));
              return (
                <li key={station.bucketId}>
                  <button
                    type="button"
                    onClick={() => setOpenBucket(station.bucketId)}
                    className="w-full px-5 py-4 text-left transition-colors hover:bg-bg"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-sans text-lg font-bold">{station.name}</span>
                        <span className="block text-sm text-muted">{station.location}</span>
                      </span>
                      <StatusBadge status={station.status} />
                    </span>
                    <span className="mt-3 flex items-center gap-3">
                      <span className="flex-1">
                        <ProgressBar percent={percent} color={meta.bar} height={6} />
                      </span>
                      <span className="w-16 text-right font-sans text-sm font-semibold">{percent}% full</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {showAdd ? <AddStationModal onClose={() => setShowAdd(false)} /> : null}
      <StationDialogs bucketId={openBucket} onClose={() => setOpenBucket(null)} />
    </div>
  );
}
