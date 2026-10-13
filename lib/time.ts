/**
 * Demo timestamps: the date comes from the demo day being shown and the time
 * from the real clock, so anything a presenter does lands inside the replay.
 */

function parseIso(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

/** "1:18 PM" */
export function clockTime(now: Date = new Date()): string {
  return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "2022-03-11" -> "3/11" */
export function shortDate(isoDate: string): string {
  const date = parseIso(isoDate);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

/** "2022-03-11" -> "Mar 11" */
export function monthDay(isoDate: string): string {
  return parseIso(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "2022-03-11" -> "Mar 11, 2022" */
export function longDate(isoDate: string): string {
  return parseIso(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2022-03-11" -> "Friday" */
export function weekdayName(isoDate: string, format: "long" | "short" = "long"): string {
  return parseIso(isoDate).toLocaleDateString("en-US", { weekday: format, timeZone: "UTC" });
}

/** Whole days from `fromIso` to `toIso`. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86_400_000);
}

/** "9:30 AM" -> 9.5 */
export function hoursOfDay(time: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return 0;
  const hour = Number(match[1]) % 12 + (match[3]!.toUpperCase() === "PM" ? 12 : 0);
  return hour + Number(match[2]) / 60;
}

/** "3/11, 9:40 AM", for tables. */
export function tableStamp(isoDate: string, now: Date = new Date()): string {
  return `${shortDate(isoDate)}, ${clockTime(now)}`;
}

/** "Mar 11, 2022 at 9:40 AM", for notes. */
export function noteStamp(isoDate: string, now: Date = new Date()): string {
  return `${longDate(isoDate)} at ${clockTime(now)}`;
}
