"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { sendJson } from "@/lib/api/client";
import { buildDay, type LiveDay } from "@/lib/live/day";
import type { ApiNotes, DataSource, LiveData, WeatherDay } from "@/lib/live/types";

interface LiveValue {
  day: LiveDay;
  /** Today's position in `weather` (forecasts count days from here) */
  dayIndex: number;
  /** Past two weeks, today, and the week ahead */
  weather: WeatherDay[];
  notes: ApiNotes;
  source: DataSource;
  /** Re-read everything from the server */
  refresh: () => void;
  /**
   * A write through the /api proxy: on success the page re-reads its data, on failure the message
   * shows in a banner. Resolves to whether it worked.
   */
  send: (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => Promise<boolean>;
}

const LiveContext = createContext<LiveValue | null>(null);

/** How often the browser asks the worker whether anything changed (GET /live, a short version string). */
const POLL_SECONDS = 5;

export default function LiveProvider({ data, children }: { data: LiveData; children: ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const day = useMemo(() => buildDay(data), [data]);
  const refresh = useCallback(() => router.refresh(), [router]);

  // Keep the page live: re-render the server data only when the worker says something changed.
  useEffect(() => {
    if (data.source !== "live") return;
    let version: string | null = null;
    let first = true;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        const next = response.ok ? (((await response.json()) as { version?: string }).version ?? null) : null;
        if (!first && next !== null && next !== version) router.refresh();
        version = next;
      } catch {
        // offline for a moment; try again next tick
      } finally {
        first = false;
        busy = false;
      }
    };
    void tick();
    const timer = setInterval(tick, POLL_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [router, data.source]);

  const send = useCallback<LiveValue["send"]>(
    async (method, path, body) => {
      try {
        await sendJson(method, path, body);
        setError(null);
        router.refresh();
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      }
    },
    [router],
  );

  const value = useMemo<LiveValue>(
    () => ({
      day,
      dayIndex: day.index,
      weather: data.weather,
      notes: data.notes,
      source: data.source,
      refresh,
      send,
    }),
    [day, data.weather, data.notes, data.source, refresh, send],
  );

  return (
    <LiveContext.Provider value={value}>
      {children}
      {error ? (
        <div
          role="alert"
          className="fixed right-4 bottom-20 left-4 z-[60] flex items-start justify-between gap-4 rounded-2xl border border-[#F3C2BD] bg-[#FBE3E0] px-5 py-3 text-sm text-[#A3221A] shadow-lg md:bottom-6 md:left-auto md:max-w-md"
        >
          <span>
            <span className="font-semibold">That didn&apos;t save.</span> {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 font-semibold underline">
            Dismiss
          </button>
        </div>
      ) : null}
    </LiveContext.Provider>
  );
}

export function useLive(): LiveValue {
  const context = useContext(LiveContext);
  if (!context) throw new Error("useLive must be used inside LiveProvider");
  return context;
}
