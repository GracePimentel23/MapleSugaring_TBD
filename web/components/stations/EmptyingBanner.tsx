"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DropIcon, ExclamationIcon } from "@/components/icons";
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
  const items = useEmptyingNow();
  if (items.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 space-y-2 px-4 pt-2 pb-1 md:px-6 lg:px-10">
      {items.map(({ session, station, leftLabel, paused, left, continueHref }) => (
        <div
          key={session.bucketId}
          role="status"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#C9D6E2] bg-[#E4ECF2] px-4 py-3 text-[#2E4A62] shadow-sm"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
            {paused ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7E98B0] opacity-30 motion-reduce:hidden" />
            ) : null}
            <DropIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-sans text-body font-semibold">
              {paused ? `Emptying ${station.name}` : `${station.name}: finish logging the collection`}
            </p>
            <p className="flex items-center gap-1.5 text-sm">
              <ExclamationIcon size={15} strokeWidth={2} className="shrink-0" />
              <span>
                {paused ? (
                  <>
                    Weight alerts paused · <span className="font-semibold tabular-nums">{leftLabel}</span> left
                  </>
                ) : left > 0 ? (
                  "Weight alerts could not be paused, so empty it gently."
                ) : (
                  "The pause is over and weight alerts are back on."
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
