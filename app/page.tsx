import ConditionCards from "@/components/dashboard/ConditionCards";
import ProductionSummary from "@/components/dashboard/ProductionSummary";
import SapCollectedChart from "@/components/dashboard/SapCollectedChart";
import StationsPanel from "@/components/dashboard/StationsPanel";
import { getDashboardView } from "@/lib/selectors/dashboard";

export default function Home() {
  const dashboard = getDashboardView();

  return (
    <div className="flex h-full gap-6 p-4 md:p-6">
      <div className="min-w-0 flex-1">
        <h1 className="mb-5 font-sans text-3xl font-semibold tracking-tight text-text">
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
