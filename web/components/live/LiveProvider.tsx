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
import { CheckCircleIcon } from "@/components/icons";
import { sendJson } from "@/lib/api/client";
import { useBrowserList } from "@/lib/demo/browserStore";
import { buildDay, type LiveDay } from "@/lib/live/day";
import type { ApiNotes, DataSource, LiveData, WeatherDay } from "@/lib/live/types";

/** Something added or deleted in this browser, and when (front-end demo storage, see browserStore). */
export interface ChangeStamp {
  kind: "added" | "deleted";
  /** "Collection", "Batch", "Station", "Note" */
  what: string;
  /** "collections/c12": the API path of the record, when known */
  record: string;
  /** ISO timestamp */
  at: string;
  by: string;
}

/** The records whose adds and deletes are stamped, by their API path. */
const STAMPED: Record<string, string> = {
  collections: "Collection",
  batches: "Batch",
  stations: "Station",
  notes: "Note",
};

/** What a successful write did, if it added or deleted a record: POST /collections, DELETE /collections/c12. */
function stampFor(method: string, path: string, body: unknown, reply: unknown): ChangeStamp | null {
  const [root = "", id, extra] = path.replace(/^\//, "").split("/");
  const what = STAMPED[root];
  if (!what || extra) return null;
  const by = (body as { by?: string } | undefined)?.by ?? "";
  const at = new Date().toISOString();
  if (method === "POST" && !id) {
    const newId = (reply as { id?: string | number } | null)?.id;
    return { kind: "added", what, record: newId === undefined ? root : `${root}/${newId}`, at, by };
  }
  if (method === "DELETE" && id) return { kind: "deleted", what, record: `${root}/${id}`, at, by };
  return null;
}

/** "Nov 11, 3:42 PM" in the club's time zone */
export function stampLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "3:42 PM" in the club's time zone */
export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
}

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
  /** Like send, but hands back the worker's reply (e.g. a new id), or null if it failed */
  call: <T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => Promise<T | null>;
  /** Adds and deletes made in this browser, newest first, with when they happened */
  changes: ChangeStamp[];
  /** When a record ("collections/c12") was added here, or null if not known */
  addedAt: (record: string) => string | null;
}

const LiveContext = createContext<LiveValue | null>(null);

/** How often the browser asks the worker whether anything changed (GET /live, a short version string). */
const POLL_SECONDS = 5;

export default function LiveProvider({ data, children }: { data: LiveData; children: ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Every add and delete gets a timestamp: kept in this browser until the worker stores them.
  const [changes, setChanges] = useBrowserList<ChangeStamp>("changes");
  const [toast, setToast] = useState<ChangeStamp | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
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

  const call = useCallback(
    async <T,>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T | null> => {
      try {
        const data = await sendJson<T>(method, path, body);
        setError(null);
        const stamp = stampFor(method, path, body, data);
        if (stamp) {
          setChanges((current) => [stamp, ...current].slice(0, 300));
          setToast(stamp);
        }
        router.refresh();
        return data;
      } catch (err) {
        setError((err as Error).message);
        return null;
      }
    },
    [router, setChanges],
  );

  const addedAt = useCallback(
    (record: string) => changes.find((item) => item.kind === "added" && item.record === record)?.at ?? null,
    [changes],
  );

  const send = useCallback<LiveValue["send"]>(
    async (method, path, body) => (await call(method, path, body)) !== null,
    [call],
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
      call,
      changes,
      addedAt,
    }),
    [day, data.weather, data.notes, data.source, refresh, send, call, changes, addedAt],
  );

  return (
    <LiveContext.Provider value={value}>
      {children}
      {toast && !error ? (
        <div
          role="status"
          className="fixed right-4 bottom-20 left-4 z-[60] flex items-center gap-3 rounded-2xl bg-accent px-5 py-3 text-sm text-white shadow-lg md:bottom-6 md:left-auto md:max-w-md"
        >
          <CheckCircleIcon size={20} className="shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">
              {toast.what} {toast.kind}
            </span>{" "}
            · {stampLabel(toast.at)}
          </span>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 font-semibold underline">
            OK
          </button>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="fixed right-4 bottom-20 left-4 z-[60] flex items-start justify-between gap-4 rounded-2xl bg-[#FBE3E0] px-5 py-3 text-sm text-[#A3221A] shadow-lg md:bottom-6 md:left-auto md:max-w-md"
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
