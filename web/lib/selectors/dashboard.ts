import { collection_logs, dashboardMeta } from "@/lib/data/mock";
import type { ProductionStat, WeeklyCollectionPoint } from "@/lib/types/schema";
import { formatLbs, litersToLbs } from "@/lib/units";
import { getStationSummary } from "@/lib/selectors/stations";

export function getWeeklyCollection(): WeeklyCollectionPoint[] {
  const byDay = new Map<string, number>();

  for (const log of collection_logs) {
    const dayKey = log.collected_at.slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + log.volume_collected_liters);
  }

  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return days.map(([dayKey, liters], index) => {
    const isToday = index === days.length - 1;
    const [year, month, day] = dayKey.split("-").map(Number);
    const weekday = weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

    return {
      day: isToday ? "Today" : weekday,
      lbs: litersToLbs(liters),
    };
  });
}

export function getProductionSummary(): {
  periodLabel: string;
  items: ProductionStat[];
} {
  const { production } = dashboardMeta;
  return {
    periodLabel: production.periodLabel,
    items: [
      { label: "Sap Collected", value: formatLbs(production.sapCollectedLbs) },
      { label: "Sap Processed", value: formatLbs(production.sapProcessedLbs) },
      { label: "Syrup Produced", value: formatLbs(production.syrupProducedLbs) },
    ],
  };
}

export function getDashboardView() {
  const stationSummary = getStationSummary();

  return {
    meta: dashboardMeta,
    weeklyCollection: getWeeklyCollection(),
    production: getProductionSummary(),
    ...stationSummary,
    hasUnreadAlerts: stationSummary.alertCount > 0 || Boolean(dashboardMeta.weatherAlert),
  };
}
