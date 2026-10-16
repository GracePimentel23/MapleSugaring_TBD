import type { DemoDay } from "@/lib/demo/timeline";
import { daysBetween } from "@/lib/time";

/** Seasons usually run 4 to 6 weeks; the progress bar plans for about five and a half. */
export const TYPICAL_SEASON_DAYS = 38;

/** "Day 11 of the sugaring season": days since the season started. */
export function seasonDay(todayIso: string, seasonStartIso: string): number {
  return Math.max(daysBetween(seasonStartIso, todayIso), 1);
}

export type FlowRating = "good" | "fair" | "slow";

/**
 * How a day's sap should run. Sap runs best when the night freezes and the day
 * climbs past about 40°F.
 */
export function flowRating(lowF: number, highF: number): FlowRating {
  if (lowF <= 30 && highF >= 40) return "good";
  if (lowF <= 32 && highF >= 36) return "fair";
  return "slow";
}

export const flowRatingMeta: Record<FlowRating, { label: string; color: string }> = {
  good: { label: "Good flow", color: "var(--color-status-online)" },
  fair: { label: "Fair", color: "var(--color-status-due)" },
  slow: { label: "Slow", color: "var(--color-text)" },
};

/** One plain sentence about today's sap, for the dashboard. */
export function sapStory(day: DemoDay): string {
  const flow = day.meta.sapCondition.flow.toLowerCase();
  const running = flow === "strong" || flow === "peak" || flow === "moderate";
  const headline = day.meta.sapCondition.headline;
  const lead = running ? "Sap is running" : flow === "none" ? "Sap is resting" : "Sap is slow";
  return `${lead}: ${headline.charAt(0).toLowerCase()}${headline.slice(1)}.`;
}

/** "Good Morning" / "Good Afternoon" / "Good Evening" from the real clock. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export type SeasonPhase =
  | { kind: "before"; start: string; daysUntil: number }
  | { kind: "during"; start: string; end: string; day: number }
  | { kind: "after"; start: string; end: string };

/**
 * Where today sits against the active season's dates (Settings > Units & Season).
 * With no active season, the most recent one counts as finished.
 */
export function seasonPhase(
  todayIso: string,
  seasons: { start: string; end: string; status: "active" | "closed" }[],
): SeasonPhase | null {
  const season = seasons.find((item) => item.status === "active") ?? seasons[0];
  if (!season) return null;
  if (todayIso < season.start) {
    return { kind: "before", start: season.start, daysUntil: daysBetween(todayIso, season.start) };
  }
  if (season.status === "active" && todayIso <= season.end) {
    return { kind: "during", start: season.start, end: season.end, day: seasonDay(todayIso, season.start) };
  }
  return { kind: "after", start: season.start, end: season.end };
}
