import { config } from "../config.js";

/** "9:30AM" in the grove's timezone, the format the station cards use. */
export function clockLabel(value, timeZone = config.timeZone) {
  if (!value) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}${get("dayPeriod").toUpperCase()}`;
}

/** "YYYY-MM-DD" for an instant, in the grove's timezone. */
export function localDate(value, timeZone = config.timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(value));
}

export function sapSeason(value) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 6 ? year + 1 : year;
}
