"use client";

import { useEffect, useState } from "react";
import { DropIcon, InfoIcon, PlusIcon, SortIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { AddStationModal } from "@/components/stations/StationForms";
import StationDialogs from "@/components/stations/StationSheet";
import StationsMap from "@/components/stations/StationsMap";
import StatusBadge from "@/components/stations/StatusBadge";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { Button, Card, cx, EmptyState, FilterPill, PageHeader, ProgressBar } from "@/components/ui/ui";
import {
  byUrgency,
  getStationSummary,
  matchesFilter,
  stationStatusMeta,
  type StationFilter,
} from "@/lib/selectors/stations";
import type { StationStatus, StationView } from "@/lib/types/schema";

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
  const { weight } = useClubSettings();
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
    </article>
  );
}

function StatusLegend() {
  const items: [StationStatus, string][] = [
    ["filling", "Collecting sap normally."],
    ["due", "Nearly full, or the sap has waited too long. Collect it."],
    ["full", "At the full mark. Empty it now."],
    ["lowBattery", "Replace the sensor battery soon."],
    ["offline", "The sensor stopped reporting. Check the hardware."],
    ["maintenance", "Alerts are paused while someone services it."],
  ];
  return (
    <div className="absolute top-full right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-white p-4 text-left shadow-xl">
      <p className="mb-3 font-sans text-base font-semibold">What the statuses mean</p>
      <dl className="space-y-3 text-sm">
        {items.map(([status, text]) => (
          <div key={status}>
            <dt>
              <StatusBadge status={status} size="sm" />
            </dt>
            <dd className="mt-1 text-muted">{text}</dd>
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
    document.getElementById(`station-${focusedBucketId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(clearFocus, FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [focusedBucketId, clearFocus]);

  const { onlineCount, attentionCount } = getStationSummary(stations);
  const counts = Object.fromEntries(
    filters.map((item) => [item.id, stations.filter((station) => matchesFilter(station, item.id)).length]),
  ) as Record<StationFilter, number>;

  const visible = stations.filter((station) => matchesFilter(station, filter));
  const sorted = urgentFirst ? [...visible].sort(byUrgency) : visible;

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

      {/* Sort and the status legend float at the right end of the first row; the pills flow around
          them and wrap underneath, so on a phone nothing is cut off and nothing sits on its own row. */}
      <div className="mb-4 flow-root">
        <div className="float-right mb-2 ml-1 flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => setUrgentFirst(!urgentFirst)}
            aria-pressed={urgentFirst}
            aria-label={
              urgentFirst
                ? "Sorted by most urgent first. Sort by bucket number"
                : "Sorted by bucket number. Sort by most urgent first"
            }
            title={urgentFirst ? "Sorted: most urgent first" : "Sorted: bucket number"}
            className={cx(
              "flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-full border font-sans text-sm font-semibold transition-colors max-sm:w-[38px] sm:px-3",
              urgentFirst
                ? "border-accent bg-accent-light text-accent"
                : "border-border bg-white text-muted hover:text-text",
            )}
          >
            <SortIcon size={18} />
            <span className="hidden sm:inline">{urgentFirst ? "Most urgent" : "Bucket #"}</span>
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              aria-label="What the statuses mean"
              aria-expanded={showLegend}
              className={cx(
                "flex h-[38px] w-[38px] items-center justify-center rounded-full border transition-colors",
                showLegend
                  ? "border-accent bg-accent-light text-accent"
                  : "border-border bg-white text-muted hover:text-text",
              )}
            >
              <InfoIcon size={18} />
            </button>
            {showLegend ? <StatusLegend /> : null}
          </div>
        </div>
        {filters.map((item) => (
          <FilterPill
            key={item.id}
            label={item.label}
            count={counts[item.id]}
            active={filter === item.id}
            onClick={() => setFilter(item.id)}
            className="mr-1.5 mb-2 align-top max-md:gap-1.5 max-md:px-3 max-md:text-[14px] md:mr-2"
          />
        ))}
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

      <h2 className="font-sans text-2xl font-bold max-md:pt-4">Sugarbush Map</h2>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-muted">
        Where each bucket sits around the Lobozzo Alumni House. Ring color shows its status. Drag to move, tap a pin to
        open that station.
      </p>

      <Card className="p-4">
        <StationsMap
          stations={visible}
          highlightedId={focusedBucketId}
          onSelect={(bucketId) => setOpenBucket(bucketId)}
        />
      </Card>

      {showAdd ? <AddStationModal onClose={() => setShowAdd(false)} /> : null}
      <StationDialogs bucketId={openBucket} onClose={() => setOpenBucket(null)} />
    </div>
  );
}
