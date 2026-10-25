import "server-only";

import { fetchWorker } from "@/lib/api/server";
import type { ApiAlert, ApiDashboard, ApiNotes, ApiStation, LiveData } from "@/lib/live/types";
import { loadWeather, todayIso } from "@/lib/live/weather";
import type { Batch, Collection, SeasonSummary } from "@/lib/types/schema";

interface StationsResponse {
  stations: ApiStation[];
}

/**
 * Everything the screens need, in one go per render. A part this visitor's role may not read
 * (401/403, e.g. collections for a guest) comes back empty; the UI hides it anyway.
 */
export async function loadLive(): Promise<LiveData> {
  const today = todayIso();
  const [stations, alerts, collections, batches, seasons, dashboard, notes, weather] = await Promise.all([
    fetchWorker<StationsResponse>("/stations"),
    fetchWorker<ApiAlert[]>("/alerts?all"),
    fetchWorker<Collection[]>("/collections"),
    fetchWorker<Batch[]>("/batches"),
    fetchWorker<SeasonSummary[]>("/seasons"),
    fetchWorker<ApiDashboard>("/dashboard"),
    fetchWorker<ApiNotes>("/notes"),
    loadWeather(today),
  ]);

  return {
    source: stations ? "live" : "offline",
    today,
    stations: stations?.stations ?? [],
    alerts: alerts ?? [],
    collections: collections ?? [],
    batches: batches ?? [],
    seasons: seasons ?? [],
    dashboard,
    notes: notes ?? { bucket: {}, batch: {} },
    weather,
  };
}
