"use client";

import { useState } from "react";
import NeedsAttention from "@/components/dashboard/NeedsAttention";
import NextSteps from "@/components/dashboard/NextSteps";
import StationTile from "@/components/dashboard/StationTile";
import SummaryCards from "@/components/dashboard/SummaryCards";
import StationDialogs from "@/components/stations/StationSheet";
import { useAlerts, useStationCards } from "@/components/stations/StationStateProvider";
import { getStationSummary } from "@/lib/selectors/stations";

export default function Home() {
  const stations = useStationCards();
  const { active } = useAlerts();
  const [openBucket, setOpenBucket] = useState<number | null>(null);
  const { onlineCount } = getStationSummary(stations);

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <h1 className="mt-2 mb-6 font-sans text-3xl font-bold tracking-tight md:text-[44px]">
        Today&apos;s Sap Activity
      </h1>

      <NeedsAttention alerts={active} />
      <SummaryCards />

      <h2 className="mb-4 font-sans text-lg font-semibold md:text-xl">
        Stations · {onlineCount} Online
      </h2>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stations.map((station) => (
            <StationTile
              key={station.bucketId}
              station={station}
              onOpen={() => setOpenBucket(station.bucketId)}
            />
          ))}
        </div>
        <div>
          <NextSteps stations={stations} />
        </div>
      </div>

      <StationDialogs bucketId={openBucket} onClose={() => setOpenBucket(null)} />
    </div>
  );
}
