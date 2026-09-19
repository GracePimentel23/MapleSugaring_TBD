"use client";

import ConditionCards from "@/components/dashboard/ConditionCards";
import ProductionSummary from "@/components/dashboard/ProductionSummary";
import SapCollectedChart from "@/components/dashboard/SapCollectedChart";
import StationsPanel from "@/components/dashboard/StationsPanel";
import { useDemo } from "@/components/demo/DemoProvider";
import { getDashboardView } from "@/lib/selectors/dashboard";

export default function Home() {
  const { day } = useDemo();
  const dashboard = getDashboardView(day);

  return (
    <div
      className="flex w-full"
      style={{ padding: "24px 27px", rowGap: 24, columnGap: 86, flexWrap: "wrap" }}
    >
      <div style={{ flexGrow: 0, flexBasis: "auto", width: 596, minWidth: 0, maxWidth: "100%" }}>
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
