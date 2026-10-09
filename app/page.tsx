"use client";

import ConditionCards from "@/components/dashboard/ConditionCards";
import ProductionSummary from "@/components/dashboard/ProductionSummary";
import SapCollectedChart from "@/components/dashboard/SapCollectedChart";
import StationsPanel from "@/components/dashboard/StationsPanel";
import { useDemo } from "@/components/demo/DemoProvider";
import { useStationState } from "@/components/stations/StationStateProvider";
import { getDashboardView } from "@/lib/selectors/dashboard";

export default function Home() {
  const { day } = useDemo();
  const { maintenance, notes } = useStationState();
  const dashboard = getDashboardView(day, { maintenance, notes });

  return (
    <div className="flex min-h-full w-full flex-wrap gap-6 p-4 md:p-6 xl:flex-nowrap">
      <div className="w-full min-w-0 flex-1">
        <h1 className="mb-5 font-sans text-2xl font-semibold md:text-3xl">
          Today&apos;s Sap Activity.
        </h1>

        <ConditionCards meta={dashboard.meta} />

        <ProductionSummary
          periodLabel={dashboard.production.periodLabel}
          items={dashboard.production.items}
        />

        <SapCollectedChart data={dashboard.weeklyCollection} />
      </div>

      <StationsPanel
        stations={dashboard.stations}
        summaryLabel={dashboard.summaryLabel}
      />
    </div>
  );
}
