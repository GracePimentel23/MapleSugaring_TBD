"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, DropIcon, ExclamationIcon } from "@/components/icons";
import { useLive } from "@/components/live/LiveProvider";
import {
  useStationCards,
  useStationState,
  type EmptyingSession,
} from "@/components/stations/StationStateProvider";
import { Button } from "@/components/ui/ui";
import type { StationView } from "@/lib/types/schema";

/** The time now, updated every second while something is counting down. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** "1:42" */
function clock(ms: number): string {
  const seconds = Math.max(Math.ceil(ms / 1000), 0);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export interface EmptyingNow {
  session: EmptyingSession;
  station: StationView;
  /** ms left on the pause; 0 once it is over */
  left: number;
  /** "1:42" */
  leftLabel: string;
  /** The worker has the bucket paused right now */
  paused: boolean;
  /** Where Continue goes: the guided Log Collection on the Collections page */
  continueHref: string;
  /** Length of the pause in whole minutes, e.g. 2 */
  minutes: number;
}

/**
 * Buckets someone pressed Start Collection on, with a live countdown. While the pause runs the
 * bucket's own alerts are hidden, so this is what tells everyone it is being emptied.
 */
export function useEmptyingNow(): EmptyingNow[] {
  const { emptying } = useStationState();
  const stations = useStationCards();
  const now = useNow(emptying.length > 0);
  return emptying.flatMap((session) => {
    const station = stations.find((item) => item.bucketId === session.bucketId);
    if (!station) return [];
    const left = Math.max(session.until - now, 0);
    return [
      {
        session,
        station,
        left,
        leftLabel: clock(left),
        // The worker's own state once it has caught up; until then, whether it accepted the pause.
        paused: left > 0 && (station.status === "emptying" || session.pauseOk !== false),
        continueHref: `/data/collections?empty=${session.bucketId}&into=${session.into ?? "new"}&lbs=${session.lbs}`,
        minutes: Math.max(Math.round((session.until - session.startedAt) / 60_000), 1),
      },
    ];
  });
}

/**
 * Pinned to the top of every page while a bucket is being emptied: which bucket, how long its
 * weight alerts stay paused, and buttons to resume alerts early or carry on logging it.
 */
export default function EmptyingBanner() {
  const { cancelEmptying } = useStationState();
  const { refresh } = useLive();
  const items = useEmptyingNow();
  const timeUp = items.filter((item) => item.left === 0).map((item) => item.session.bucketId).join(",");
  const refreshedFor = useRef("");

  // When a pause runs out, re-read the stations at once: the worker has switched the bucket's
  // weight alerts back on, and its alert should come back now rather than on the next change.
  useEffect(() => {
    if (timeUp && timeUp !== refreshedFor.current) refresh();
    refreshedFor.current = timeUp;
  }, [timeUp, refresh]);

  if (items.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 space-y-2 px-4 pt-2 pb-1 md:px-6 lg:px-10">
      {items.map(({ session, station, leftLabel, paused, left, continueHref, minutes }) => (
        <div
          key={session.bucketId}
          role="status"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-[#E4ECF2] px-4 py-3 text-[#2E4A62] shadow-card"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
            {paused ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7E98B0] opacity-30 motion-reduce:hidden" />
            ) : null}
            {left === 0 ? <CheckCircleIcon size={18} /> : <DropIcon size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-sans text-body font-semibold">Emptying {station.name}</p>
            <p className="flex items-center gap-1.5 text-sm">
              {left === 0 ? null : <ExclamationIcon size={15} strokeWidth={2} className="shrink-0" />}
              <span>
                {paused ? (
                  <>
                    Weight alerts paused · <span className="font-semibold tabular-nums">{leftLabel}</span> left
                  </>
                ) : left > 0 ? (
                  "Weight alerts could not be paused, so empty it gently."
                ) : (
                  `${minutes} minute${minutes === 1 ? " is" : "s are"} up and weight alerts are resumed.`
                )}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2E4A62]/30 text-[#2E4A62] hover:bg-white"
              onClick={() => cancelEmptying(session.bucketId)}
            >
              {paused ? "Resume Alerts" : "Dismiss"}
            </Button>
            <Link
              href={continueHref}
              className="inline-flex items-center rounded-xl bg-[#2E4A62] px-3 py-1.5 font-sans text-sm font-semibold text-white hover:bg-[#243B4F]"
            >
              Log Collection
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
