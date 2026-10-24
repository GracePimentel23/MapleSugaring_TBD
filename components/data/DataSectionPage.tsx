"use client";

import Link from "next/link";
import Analysis from "@/components/data/Analysis";
import Batches from "@/components/data/Batches";
import Collections from "@/components/data/Collections";
import Overview from "@/components/data/Overview";
import { dataSections, type DataSectionId } from "@/components/data/sections";
import { useDemo } from "@/components/demo/DemoProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationState } from "@/components/stations/StationStateProvider";
import { cx } from "@/components/ui/ui";
import type { Collection } from "@/lib/types/schema";

export default function DataSectionPage({ section }: { section: DataSectionId }) {
  const { day, dayIndex } = useDemo();
  const { loggedCollections } = useStationState();
  const { shows } = useSession();

  // Collections logged in the app today show up alongside the timeline's.
  const logged: Collection[] = loggedCollections
    .filter((entry) => entry.dayIndex <= dayIndex)
    .map((entry) => ({
      id: `logged-${entry.id}`,
      collectionNumber: day.collections.length + entry.id,
      date: entry.date,
      entries: [
        {
          bucketId: entry.bucketId,
          bucketName: entry.bucketName,
          collectedBy: entry.collectedBy,
          lbs: entry.lbs,
        },
      ],
      totalLbs: entry.lbs,
      batchName: entry.batchNumber,
      loggedBy: entry.collectedBy,
      notes: entry.note || undefined,
    }));
  const dayWithLogs = { ...day, collections: [...logged, ...day.collections] };

  return (
    <div className="flex min-h-full w-full flex-col">
      {/* On web the subsections live in the side nav; phones keep the tabs. */}
      <div className="no-scrollbar flex gap-6 overflow-x-auto border-b border-border px-4 pt-2 md:hidden">
        {dataSections.filter((tab) => shows(`data.${tab.id}`)).map((tab) => {
          const active = section === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cx(
                "-mb-px shrink-0 border-b-2 py-2.5 font-sans text-[16px]",
                active ? "border-accent font-semibold text-accent" : "border-transparent text-muted",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1 md:pt-0">
        {section === "overview" ? <Overview day={day} /> : null}
        {section === "collections" ? <Collections day={dayWithLogs} /> : null}
        {section === "batches" ? <Batches day={day} /> : null}
        {section === "analysis" ? <Analysis day={day} /> : null}
      </div>
    </div>
  );
}
