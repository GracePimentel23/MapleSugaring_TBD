"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import AlertIcon, { alertDetail, alertHeadline, urgencyOf } from "@/components/alerts/AlertIcon";
import ResolveAlertModal from "@/components/alerts/ResolveAlertModal";
import { useBatchState } from "@/components/data/BatchStateProvider";
import { useLive } from "@/components/live/LiveProvider";
import { ChevronRightIcon, DropIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { useEmptyingNow, type EmptyingNow } from "@/components/stations/EmptyingBanner";
import { useAlerts, useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import type { ClubAlert } from "@/lib/types/schema";

/** How many next steps show before "See all": enough to act on, short enough to read at a glance. */
const MAX_STEPS = 5;

/** The icon column: 36px, so every row's text lines up whatever sits there. */
const ICON = 36;

/** Boiling reminders: batches are not alerts, so these link to the Batches page instead. */
function batchSteps(batches: { batchNumber: string; status: string }[]) {
  return batches.flatMap((batch) =>
    batch.status === "processing"
      ? [{ key: `boil-${batch.batchNumber}`, title: "Boiling", detail: `Check ${batch.batchNumber} on the evaporator` }]
      : batch.status === "waiting"
        ? [{ key: `wait-${batch.batchNumber}`, title: "Ready to Boil", detail: `${batch.batchNumber} is waiting in storage` }]
        : [],
  );
}

/** Headline in bold, one grey line under it. */
function Lines({ title, detail }: { title: string; detail: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-sans text-body font-semibold">{title}</span>
      <span className="block text-sm text-muted">{detail}</span>
    </span>
  );
}

/**
 * Time left on the pause as a ring that empties as it runs out: the countdown at a glance, with
 * the exact time beside it in words.
 */
function PauseRing({ item }: { item: EmptyingNow }) {
  const total = Math.max(item.session.until - item.session.startedAt, 1);
  const share = item.paused ? Math.min(item.left / total, 1) : 0;
  const radius = 15;
  const length = 2 * Math.PI * radius;
  return (
    <span className="relative flex shrink-0 items-center justify-center text-[#2E4A62]" style={{ width: ICON, height: ICON }}>
      <svg width={ICON} height={ICON} viewBox="0 0 36 36" aria-hidden="true" className="-rotate-90">
        <circle cx="18" cy="18" r={radius} fill="#E4ECF2" stroke="#C9D6E2" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - share)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute">
        <DropIcon size={14} />
      </span>
    </span>
  );
}

const rowClass =
  "group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-bg";

/**
 * What needs doing, most urgent first and at most five. Each row leads with the situation ("Sap
 * Spoiling") and says which bucket and how bad under it. Buckets being emptied come first, with a
 * ring counting down their pause and a stop button to end it early; then the alerts, each with its
 * own icon colored by urgency, opening the resolve pop-up; then boiling reminders.
 */
export default function NextSteps() {
  const { day } = useLive();
  const { can } = useSession();
  const { viewBatch } = useBatchState();
  const { active } = useAlerts();
  const stations = useStationCards();
  const { cancelEmptying } = useStationState();
  const emptying = useEmptyingNow();
  // Kept as the alert itself: Start Collection pauses its bucket, which takes it out of the live list.
  const [opened, setOpened] = useState<ClubAlert | null>(null);
  const batches = batchSteps(day.batches.map(viewBatch).map((view) => view.batch));
  const canResolve = can("alerts:resolve");
  const stationOf = (alert: ClubAlert) => stations.find((station) => station.bucketId === alert.bucketId);

  const rows: { key: string; node: ReactNode }[] = [
    ...emptying.map((item) => {
      const minutes = Math.round((item.session.until - item.session.startedAt) / 60_000);
      return {
        key: `emptying-${item.session.bucketId}`,
        node: (
          <div className="flex items-center gap-3 py-3">
            <Link href={item.continueHref} className="flex min-w-0 flex-1 items-center gap-3">
              <PauseRing item={item} />
              <Lines
                title={`${item.station.name} being emptied`}
                detail={
                  item.paused ? (
                    <>
                      Paused for {minutes} min · <span className="tabular-nums">{item.leftLabel}</span> left
                    </>
                  ) : (
                    "Pause is over. Finish logging it."
                  )
                }
              />
            </Link>
            {item.paused ? (
              <button
                type="button"
                onClick={() => cancelEmptying(item.session.bucketId)}
                aria-label={`Stop the pause on ${item.station.name} and turn its alerts back on`}
                title="Stop the pause: alerts back on"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-status-problem text-status-problem transition-colors hover:bg-attention-bg"
              >
                <span className="h-3 w-3 rounded-[3px] bg-current" />
              </button>
            ) : (
              <ChevronRightIcon size={18} className="shrink-0 text-muted" />
            )}
          </div>
        ),
      };
    }),
    ...active.map((alert) => ({
      key: alert.key,
      node: (
        <button
          type="button"
          disabled={!canResolve}
          onClick={() => setOpened(alert)}
          className={`${rowClass} disabled:cursor-default disabled:hover:bg-transparent`}
        >
          <AlertIcon kind={alert.kind} size={20} urgency={urgencyOf(alert)} />
          <Lines title={alertHeadline(alert)} detail={alertDetail(alert, stationOf(alert))} />
          {canResolve ? <ChevronRightIcon size={18} className="shrink-0 text-muted group-hover:text-text" /> : null}
        </button>
      ),
    })),
    ...batches.map((step) => ({
      key: step.key,
      node: (
        <Link href="/data/batches" className={rowClass}>
          <span
            className="flex shrink-0 items-center justify-center rounded-full bg-accent-light text-accent"
            style={{ width: ICON, height: ICON }}
          >
            <DropIcon size={20} />
          </span>
          <Lines title={step.title} detail={step.detail} />
          <ChevronRightIcon size={18} className="shrink-0 text-muted group-hover:text-text" />
        </Link>
      ),
    })),
  ];
  const shown = rows.slice(0, MAX_STEPS);
  const more = rows.length - shown.length;

  return (
    <section className="rounded-2xl border border-border bg-white p-5 md:p-6">
      <h2 className="border-b border-border pb-3 font-sans text-base font-semibold">Next Steps</h2>
      {rows.length === 0 ? (
        <p className="pt-4 text-body text-muted">Nothing to do right now.</p>
      ) : (
        <ul>
          {shown.map((row) => (
            <li key={row.key} className="border-b border-border last:border-0">
              {row.node}
            </li>
          ))}
        </ul>
      )}
      {more > 0 ? (
        <Link
          href="/alerts"
          className="mt-2 flex items-center justify-between rounded-xl bg-bg px-3 py-2.5 font-sans text-sm font-semibold text-accent hover:bg-accent-light"
        >
          {more} more · See all alerts
          <ChevronRightIcon size={16} />
        </Link>
      ) : null}
      {opened ? <ResolveAlertModal alert={opened} onClose={() => setOpened(null)} /> : null}
    </section>
  );
}
