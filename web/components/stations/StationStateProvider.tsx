"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLive } from "@/components/live/LiveProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { getStationCards, getWeatherAlerts, type TreeEdit } from "@/lib/selectors/stations";
import { seasonPhase } from "@/lib/selectors/season";
import { clockTime, noteStamp } from "@/lib/time";
import type { ClubAlert, StationNote, StationView } from "@/lib/types/schema";

export interface MaintenanceEntry {
  by: string;
  /** ms, or null when the API does not say when it started */
  startedAt: number | null;
  endsAt: number;
}

export interface AlertStamp {
  by: string;
  /** "3/11, 9:05 AM" */
  at: string;
}

export interface UserResolution extends AlertStamp {
  key: string;
  label: string;
  bucketLabel: string;
  /** ISO date it was resolved on */
  date: string;
  /** How it was resolved, from the resolve pop-up */
  note?: string;
  /**
   * The worker's alert row it closed, if any. That row's own history lists it under Resolved; the
   * app's matching alert stays hidden only until the worker raises a new one.
   */
  alertId?: number;
}

/** An alert put off with "Schedule for later": hidden until `until`, then back as a reminder. */
export interface Snooze {
  key: string;
  /** ms */
  until: number;
  by: string;
}

/** One bucket emptied into a collection. */
export interface CollectionEntry {
  bucketId: number;
  lbs: number;
  collectedBy: string;
}

/** A collection to log (POST /collections): one or more buckets, from the Log Collection flow. */
export interface NewCollection {
  entries: CollectionEntry[];
  /** "b3", or "" for none */
  batchId: string;
  loggedBy: string;
  /** ISO date */
  date: string;
  note: string;
}

interface StationStateValue {
  maintenance: Record<number, MaintenanceEntry>;
  toggleMaintenance: (bucketId: number) => void;
  extendMaintenance: (bucketId: number) => void;
  notes: Record<number, StationNote[]>;
  addNote: (bucketId: number, text: string) => Promise<boolean>;
  editTree: (bucketId: number, edit: TreeEdit) => Promise<boolean>;
  /** Save a station's details (name, location, species, target weight, map spot) */
  saveStation: (bucketId: number, changes: Record<string, unknown>) => Promise<boolean>;
  addStation: (station: Record<string, unknown>) => Promise<boolean>;
  retired: ReadonlySet<number>;
  retireTree: (bucketId: number) => void;
  /** Logs a collection; resolves with its id ("c12"), or null if it failed */
  logCollection: (collection: NewCollection) => Promise<string | null>;
  /** Adds buckets to a collection already logged ("Log Another Bucket") */
  addToCollection: (collectionId: string, entries: CollectionEntry[]) => Promise<boolean>;
  resolutions: UserResolution[];
  /** Mark an alert handled, with a note of how (shown under Resolved) */
  resolve: (alert: ClubAlert, note?: string) => void;
  snoozes: Snooze[];
  /** Put an alert off for `hours`; it comes back as a reminder after that */
  snooze: (alert: ClubAlert, hours: number) => void;
  /** Set when an alert is opened, so the Stations page can jump to it */
  focusedBucketId: number | null;
  focusStation: (bucketId: number) => void;
  clearFocus: () => void;
}

const StationStateContext = createContext<StationStateValue | null>(null);

/** "Mar 11, 2022 at 9:40 AM" from an ISO timestamp */
function noteTime(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
  return noteStamp(day, date);
}

/** "3/11, 9:05 AM" from an ISO timestamp */
function stampOf(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Local memory for alerts the worker has no row for (due, sap age, battery, weather: judged in the
 * browser from thresholds). Resolving or snoozing those is kept in this browser.
 */
function useLocalList<T>(key: string): [T[], (update: (current: T[]) => T[]) => void] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`tbd.${key}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      if (saved) setItems(JSON.parse(saved) as T[]);
    } catch {
      // storage blocked: start empty
    }
  }, [key]);
  const update = useCallback(
    (change: (current: T[]) => T[]) => {
      setItems((current) => {
        const next = change(current);
        try {
          window.localStorage.setItem(`tbd.${key}`, JSON.stringify(next));
        } catch {
          // not saved
        }
        return next;
      });
    },
    [key],
  );
  return [items, update];
}

/**
 * Station state on top of the API: maintenance mode (the worker's station modes), notes, edits,
 * logging collections, and the Active / Acknowledged / Resolved alert flow.
 */
export default function StationStateProvider({ children }: { children: ReactNode }) {
  const { day, notes: apiNotes, send, call } = useLive();
  const { user } = useSession();
  const { maintenanceDefaults } = useClubSettings();
  const [resolutions, setResolutions] = useLocalList<UserResolution>("resolutions");
  const [snoozes, setSnoozes] = useLocalList<Snooze>("snoozes");
  const [focusedBucketId, setFocusedBucketId] = useState<number | null>(null);

  const by = user.name;
  const nowStamp = useCallback((): AlertStamp => ({ by, at: stampOf(new Date().toISOString()) }), [by]);

  const maintenance = useMemo(() => {
    const entries: Record<number, MaintenanceEntry> = {};
    for (const bucket of day.buckets) {
      if (bucket.mode === "maintenance" && bucket.modeUntil) {
        entries[bucket.bucketId] = { by: "", startedAt: null, endsAt: new Date(bucket.modeUntil).getTime() };
      }
    }
    return entries;
  }, [day.buckets]);

  const notes = useMemo(() => {
    const byBucket: Record<number, StationNote[]> = {};
    for (const [bucketId, list] of Object.entries(apiNotes.bucket)) {
      byBucket[Number(bucketId)] = list.map((note) => ({
        id: note.id,
        text: note.text,
        author: note.author || "Someone",
        createdAt: noteTime(note.createdAt),
      }));
    }
    return byBucket;
  }, [apiNotes]);

  const retired = useMemo(
    () => new Set(day.buckets.filter((bucket) => bucket.retired).map((bucket) => bucket.bucketId)),
    [day.buckets],
  );

  const toggleMaintenance = useCallback(
    (bucketId: number) => {
      const turningOn = !maintenance[bucketId];
      void send("POST", `/stations/${bucketId}/mode`, {
        mode: turningOn ? "maintenance" : "normal",
        minutes: Math.round(maintenanceDefaults.autoOffHours * 60),
        by,
      });
    },
    [maintenance, maintenanceDefaults.autoOffHours, send, by],
  );

  const extendMaintenance = useCallback(
    (bucketId: number) => void send("POST", `/stations/${bucketId}/mode`, { mode: "maintenance", extendMinutes: 60, by }),
    [send, by],
  );

  const addNote = useCallback(
    (bucketId: number, text: string) => send("POST", "/notes", { subject: "bucket", subjectId: bucketId, text, by }),
    [send, by],
  );

  const saveStation = useCallback(
    (bucketId: number, changes: Record<string, unknown>) => send("PATCH", `/stations/${bucketId}`, { ...changes, by }),
    [send, by],
  );

  const addStation = useCallback(
    (station: Record<string, unknown>) => send("POST", "/stations", { ...station, by }),
    [send, by],
  );

  // The sensor id is the LoRa node's own id, so it is not editable here.
  const editTree = useCallback(
    (bucketId: number, edit: TreeEdit) =>
      saveStation(bucketId, { location: edit.treeLabel, treeSpecies: edit.treeSpecies }),
    [saveStation],
  );

  const retireTree = useCallback((bucketId: number) => void saveStation(bucketId, { retired: true }), [saveStation]);

  const logCollection = useCallback(
    async (collection: NewCollection) => {
      const saved = await call<{ id: string }>("POST", "/collections", {
        date: collection.date,
        batchId: collection.batchId || undefined,
        loggedBy: collection.loggedBy,
        notes: collection.note || undefined,
        entries: collection.entries,
        by,
      });
      // The note also goes on each bucket, so it shows in the station pop-up.
      if (saved && collection.note) {
        for (const entry of collection.entries) await addNote(entry.bucketId, collection.note);
      }
      return saved?.id ?? null;
    },
    [call, addNote, by],
  );

  const addToCollection = useCallback(
    (collectionId: string, entries: CollectionEntry[]) =>
      send("POST", `/collections/${collectionId}/entries`, { entries, by }),
    [send, by],
  );

  const resolve = useCallback(
    (alert: ClubAlert, note?: string) => {
      setSnoozes((current) => current.filter((item) => item.key !== alert.key));
      if (alert.alertId) void send("PATCH", `/alerts/${alert.alertId}`, { is_resolved: true, note, by });
      // Keep a week of them for Resolved This Week.
      const weekAgo = new Date(new Date(`${day.date}T12:00:00Z`).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
      setResolutions((current) => [
        {
          ...nowStamp(),
          key: alert.key,
          label: alert.label,
          bucketLabel: alert.bucketLabel,
          date: day.date,
          note,
          alertId: alert.alertId,
        },
        ...current.filter((item) => item.date > weekAgo),
      ]);
    },
    [send, by, setResolutions, setSnoozes, nowStamp, day.date],
  );

  const snooze = useCallback(
    (alert: ClubAlert, hours: number) =>
      setSnoozes((current) => [
        ...current.filter((item) => item.key !== alert.key && item.until > Date.now()),
        { key: alert.key, until: Date.now() + hours * 3_600_000, by },
      ]),
    [setSnoozes, by],
  );

  const focusStation = useCallback((bucketId: number) => setFocusedBucketId(bucketId), []);
  const clearFocus = useCallback(() => setFocusedBucketId(null), []);

  const value = useMemo<StationStateValue>(
    () => ({
      maintenance,
      toggleMaintenance,
      extendMaintenance,
      notes,
      addNote,
      editTree,
      saveStation,
      addStation,
      retired,
      retireTree,
      logCollection,
      addToCollection,
      resolutions,
      resolve,
      snoozes,
      snooze,
      focusedBucketId,
      focusStation,
      clearFocus,
    }),
    [
      maintenance,
      toggleMaintenance,
      extendMaintenance,
      notes,
      addNote,
      editTree,
      saveStation,
      addStation,
      retired,
      retireTree,
      logCollection,
      addToCollection,
      resolutions,
      resolve,
      snoozes,
      snooze,
      focusedBucketId,
      focusStation,
      clearFocus,
    ],
  );

  return <StationStateContext.Provider value={value}>{children}</StationStateContext.Provider>;
}

export function useStationState(): StationStateValue {
  const context = useContext(StationStateContext);
  if (!context) {
    throw new Error("useStationState must be used inside StationStateProvider");
  }
  return context;
}

/** Today's station cards (retired trees hidden) with alerts judged from the thresholds. */
export function useStationCards(options: { includeRetired?: boolean } = {}): StationView[] {
  const { day, weather } = useLive();
  const { thresholds } = useClubSettings();
  const { notes, retired } = useStationState();
  const includeRetired = options.includeRetired ?? false;

  return useMemo(() => {
    const cards = getStationCards(day, weather, { notes }, thresholds);
    return includeRetired ? cards : cards.filter((card) => !retired.has(card.bucketId));
  }, [day, weather, thresholds, notes, retired, includeRetired]);
}

export interface MaintenanceAlert {
  bucketId: number;
  station: StationView;
  entry: MaintenanceEntry;
  /** "10:00 AM" */
  endsLabel: string;
  startedLabel: string;
}

/**
 * Live alerts: active (needs resolving), snoozed (put off with "Schedule for later") and stations in
 * maintenance. Resolved ones are gone from here and listed under Resolved on the Alerts page.
 */
export function useAlerts() {
  const { day } = useLive();
  const { thresholds, seasons } = useClubSettings();
  const stations = useStationCards();
  const { resolutions, snoozes, maintenance } = useStationState();

  return useMemo(() => {
    // Resolved today stays hidden today. One tied to a worker alert row only hides that row's alert
    // (or the app's copy of it once the row is closed), so a bucket that fills again still alerts.
    const resolvedToday = new Map(
      resolutions.filter((item) => item.date === day.date).map((item) => [item.key, item.alertId]),
    );
    const isResolved = (alert: ClubAlert) =>
      resolvedToday.has(alert.key) &&
      (resolvedToday.get(alert.key) === undefined || !alert.alertId || alert.alertId === resolvedToday.get(alert.key));
    // Freeze and heat warnings only matter while sap is running.
    const inSeason = seasonPhase(day.date, seasons)?.kind === "during";
    const live = [...(inSeason ? getWeatherAlerts(day, thresholds) : []), ...stations.flatMap((station) => station.alerts)]
      .filter((alert) => !isResolved(alert))
      .sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"));

    // A snooze runs out by itself; until then the alert waits under Snoozed.
    // eslint-disable-next-line react-hooks/purity -- re-evaluated on every live refresh (5 s)
    const now = Date.now();
    const snoozedUntil = new Map(snoozes.filter((item) => item.until > now).map((item) => [item.key, item.until]));
    const active = live.filter((alert) => !snoozedUntil.has(alert.key));
    const snoozed = live
      .filter((alert) => snoozedUntil.has(alert.key))
      .map((alert) => ({ alert, untilLabel: clockTime(new Date(snoozedUntil.get(alert.key)!)) }));

    const maintenanceAlerts: MaintenanceAlert[] = Object.entries(maintenance).flatMap(([bucketId, entry]) => {
      const station = stations.find((item) => item.bucketId === Number(bucketId));
      if (!station) return [];
      return [
        {
          bucketId: Number(bucketId),
          station,
          entry,
          endsLabel: clockTime(new Date(entry.endsAt)),
          startedLabel: entry.startedAt ? clockTime(new Date(entry.startedAt)) : "",
        },
      ];
    });

    return { active, snoozed, maintenanceAlerts };
  }, [day, thresholds, seasons, stations, resolutions, snoozes, maintenance]);
}
