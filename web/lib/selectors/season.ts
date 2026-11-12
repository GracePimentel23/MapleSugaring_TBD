import type { LiveDay } from "@/lib/live/day";
import { daysBetween } from "@/lib/time";

/** Seasons usually run 4 to 6 weeks; the progress bar plans for about five and a half. */
export const TYPICAL_SEASON_DAYS = 38;

/** "Day 11 of the sugaring season": days since the season started. */
export function seasonDay(todayIso: string, seasonStartIso: string): number {
  return Math.max(daysBetween(seasonStartIso, todayIso), 1);
}

export type FlowRating = "best" | "good" | "fair" | "slow";

/**
 * How a day's sap should run. Sap runs when the night freezes and the day climbs past about 40°F.
 * The best days have a hard freeze (25°F or colder) and a thaw into the 40s, not much warmer: a
 * bigger swing pushes more sap, and too warm a day stops the next night's freeze.
 */
export function flowRating(lowF: number, highF: number): FlowRating {
  if (lowF <= 25 && highF >= 42 && highF <= 50) return "best";
  if (lowF <= 30 && highF >= 40) return "good";
  if (lowF <= 32 && highF >= 36) return "fair";
  return "slow";
}

/** Good or best: a day worth being out collecting. */
export const isGoodFlow = (rating: FlowRating) => rating === "best" || rating === "good";

export const flowRatingMeta: Record<FlowRating, { label: string; color: string; drops: number }> = {
  best: { label: "Best flow", color: "var(--color-status-online)", drops: 4 },
  good: { label: "Good flow", color: "var(--color-status-online)", drops: 3 },
  fair: { label: "Fair", color: "var(--color-status-due)", drops: 2 },
  slow: { label: "Slow", color: "var(--color-text)", drops: 1 },
};

/** What each kind of day looks like, for the Outlook key. */
export const FLOW_DAY_GUIDE: { rating: FlowRating; text: string }[] = [
  { rating: "best", text: "Hard freeze overnight (25°F or colder), then sun and 42° to 50°F" },
  { rating: "good", text: "Below 30°F overnight and past 40°F by afternoon" },
  { rating: "fair", text: "Just freezing at night and a 36°F thaw" },
  { rating: "slow", text: "No freeze, or too cold all day to thaw (snow and ice days)" },
];

/** One plain sentence about today's sap, for the dashboard. */
export function sapStory(day: LiveDay): string {
  const flow = day.meta.sapCondition.flow.toLowerCase();
  if (flow === "unknown") return "No weather forecast right now, so no word on how the sap will run.";
  const running = flow === "strong" || flow === "peak" || flow === "moderate";
  const headline = day.meta.sapCondition.headline;
  const lead =
    flow === "peak" ? "Sap is pouring" : running ? "Sap is running" : flow === "none" ? "Sap is resting" : "Sap is slow";
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
