import type { DemoDay } from "@/lib/demo/timeline";
import { getStationSummary, type StationOverrides } from "@/lib/selectors/stations";
import type { ProductionStat } from "@/lib/types/schema";
import { formatLbs } from "@/lib/units";

export function getProductionSummary(day: DemoDay): {
  periodLabel: string;
  items: ProductionStat[];
} {
  const { production } = day.meta;

  return {
    periodLabel: production.periodLabel,
    items: [
      { label: "Sap Collected", value: formatLbs(production.sapCollectedLbs) },
      { label: "Sap Boiled", value: formatLbs(production.sapProcessedLbs) },
      { label: "Syrup Produced", value: formatLbs(production.syrupProducedLbs) },
    ],
  };
}

export function getDashboardView(day: DemoDay, overrides: StationOverrides) {
  const stationSummary = getStationSummary(day, overrides);

  return {
    meta: day.meta,
    weeklyCollection: day.weeklyCollection,
    production: getProductionSummary(day),
    ...stationSummary,
    hasUnreadAlerts:
      stationSummary.alertCount > 0 || Boolean(day.meta.weatherAlert),
  };
}
