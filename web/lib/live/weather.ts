import "server-only";

import { GROVE_CENTER, TIME_ZONE } from "@/lib/live/place";
import type { WeatherDay } from "@/lib/live/types";

/**
 * Rochester weather from Open-Meteo (free, no key): the last two weeks and the week ahead, so the
 * dashboard, the Overview outlook and sap age all read real conditions. Cached for
 * 30 minutes. When it can't be reached the same days come back with `available: false`.
 */

export const PAST_DAYS = 14;
export const FORECAST_DAYS = 8; // today and the next 7

interface OpenMeteo {
  current?: { temperature_2m?: number };
  daily?: {
    time: string[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    snowfall_sum: (number | null)[];
    wind_speed_10m_max: (number | null)[];
    cloud_cover_mean: (number | null)[];
  };
}

/** WMO weather codes, in words. */
function summaryFor(code: number | null): string {
  if (code === null) return "No forecast";
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return code >= 65 ? "Heavy rain" : "Rain";
  if (code >= 71 && code <= 77) return code >= 75 ? "Heavy snow" : "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed";
}

function isoInZone(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

function labels(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-US", { timeZone: "UTC", ...options });
  return {
    label: format({ weekday: "long", month: "long", day: "numeric" }),
    shortLabel: format({ weekday: "short", month: "short", day: "numeric" }),
  };
}

function blankDay(iso: string): WeatherDay {
  return {
    date: iso,
    ...labels(iso),
    available: false,
    temperatureF: 0,
    lowF: 0,
    highF: 0,
    precipIn: 0,
    snowIn: 0,
    windMph: 0,
    cloudPercent: 0,
    summary: "No forecast",
  };
}

/** The window of dates around today, oldest first. */
export function windowDates(today: string): string[] {
  const start = new Date(`${today}T12:00:00Z`).getTime() - PAST_DAYS * 86_400_000;
  return Array.from({ length: PAST_DAYS + FORECAST_DAYS }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}

export function todayIso(): string {
  return isoInZone(new Date());
}

const round = (value: number | null | undefined, decimals = 0) =>
  value === null || value === undefined ? 0 : Math.round(value * 10 ** decimals) / 10 ** decimals;

export async function loadWeather(today: string): Promise<WeatherDay[]> {
  const dates = windowDates(today);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(GROVE_CENTER.lat),
    longitude: String(GROVE_CENTER.lon),
    current: "temperature_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,cloud_cover_mean",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: TIME_ZONE,
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
  }).toString();

  try {
    const response = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`open-meteo ${response.status}`);
    const body = (await response.json()) as OpenMeteo;
    const daily = body.daily;
    if (!daily) throw new Error("open-meteo sent no daily data");
    return dates.map((iso) => {
      const index = daily.time.indexOf(iso);
      if (index < 0 || daily.temperature_2m_max[index] === null) return blankDay(iso);
      const highF = round(daily.temperature_2m_max[index]);
      const lowF = round(daily.temperature_2m_min[index]);
      const now = iso === today ? body.current?.temperature_2m : undefined;
      return {
        date: iso,
        ...labels(iso),
        available: true,
        temperatureF: round(now ?? (highF + lowF) / 2),
        lowF,
        highF,
        precipIn: round(daily.precipitation_sum[index], 2),
        snowIn: round(daily.snowfall_sum[index], 2),
        windMph: round(daily.wind_speed_10m_max[index], 1),
        cloudPercent: round(daily.cloud_cover_mean[index]),
        summary: summaryFor(daily.weather_code[index] ?? null),
      };
    });
  } catch (error) {
    console.error(`weather unavailable: ${(error as Error).message}`);
    return dates.map(blankDay);
  }
}
