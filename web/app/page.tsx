import ConditionCards from "@/components/dashboard/ConditionCards";
import ProductionSummary from "@/components/dashboard/ProductionSummary";
import SapCollectedChart from "@/components/dashboard/SapCollectedChart";
import StationsPanel from "@/components/dashboard/StationsPanel";
import LiveRefresh from "@/components/common/LiveRefresh";
import { ShowFor } from "@/components/auth/AccessContext";
import { loadDashboard } from "@/lib/data/source";

export default async function Home() {
  const dashboard = await loadDashboard();

  return (
    <div
      className="flex w-full"
      style={{ padding: "24px 27px", rowGap: 24, columnGap: 86, flexWrap: "wrap" }}
    >
      <div style={{ flexGrow: 0, flexBasis: "auto", width: 596, minWidth: 0, maxWidth: "100%" }}>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="font-sans text-2xl font-semibold md:text-3xl">Today&apos;s Sap Activity.</h1>
          <LiveRefresh source={dashboard.source} />
        </div>

        <ShowFor id="dashboard.conditions">
          <ConditionCards meta={dashboard.meta} />
        </ShowFor>

        <ShowFor id="dashboard.production">
          <ProductionSummary
            periodLabel={dashboard.production.periodLabel}
            items={dashboard.production.items}
          />
        </ShowFor>

        <ShowFor id="dashboard.sapChart">
          <SapCollectedChart data={dashboard.weeklyCollection} />
        </ShowFor>
      </div>

      <ShowFor id="dashboard.stations">
        <StationsPanel
          stations={dashboard.stations}
          summaryLabel={dashboard.summaryLabel}
        />
      </ShowFor>
    </div>
  );
}
