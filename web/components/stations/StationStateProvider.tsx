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
}

/** A collection to log (POST /collections): one bucket, from the Log Collection flow. */
export interface NewCollection {
  bucketId: number;
  lbs: number;
  /** "b3", or "" for none */
  batchId: string;
  collectedBy: string;
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
  logCollection: (entry: NewCollection) => Promise<boolean>;
  acks: Record<string, AlertStamp>;
  acknowledge: (alert: ClubAlert) => void;
  /** Take back an acknowledgement, e.g. from Undo */
  unacknowledge: (alert: ClubAlert) => void;
  resolutions: UserResolution[];
  resolve: (alert: ClubAlert) => void;
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
 * browser from thresholds). Acknowledging or resolving those is kept in this browser for the day.
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
  const { day, notes: apiNotes, send } = useLive();
  const { user } = useSession();
  const { maintenanceDefaults } = useClubSettings();
  const [localAcks, setLocalAcks] = useLocalList<{ key: string; date: string; stamp: AlertStamp }>("acks");
  const [resolutions, setResolutions] = useLocalList<UserResolution>("resolutions");
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
    async (entry: NewCollection) => {
      const saved = await send("POST", "/collections", {
        date: entry.date,
        batchId: entry.batchId || undefined,
        loggedBy: entry.collectedBy,
        notes: entry.note || undefined,
        entries: [{ bucketId: entry.bucketId, lbs: entry.lbs, collectedBy: entry.collectedBy }],
        by,
      });
      if (saved && entry.note) await addNote(entry.bucketId, entry.note);
      return saved;
    },
    [send, addNote, by],
  );

  // Acknowledgements: the worker's for alerts it has a row for, this browser's for the rest (today only).
  const acks = useMemo(() => {
    const merged: Record<string, AlertStamp> = {};
    for (const item of localAcks) if (item.date === day.date) merged[item.key] = item.stamp;
    return merged;
  }, [localAcks, day.date]);

  const acknowledge = useCallback(
    (alert: ClubAlert) => {
      if (alert.alertId) {
        void send("PATCH", `/alerts/${alert.alertId}`, { acknowledged: true, by });
        return;
      }
      setLocalAcks((current) => [
        ...current.filter((item) => item.key !== alert.key),
        { key: alert.key, date: day.date, stamp: nowStamp() },
      ]);
    },
    [send, by, setLocalAcks, day.date, nowStamp],
  );

  const unacknowledge = useCallback(
    (alert: ClubAlert) => {
      if (alert.alertId) {
        void send("PATCH", `/alerts/${alert.alertId}`, { acknowledged: false, by });
        return;
      }
      setLocalAcks((current) => current.filter((item) => item.key !== alert.key));
    },
    [send, by, setLocalAcks],
  );

  const resolve = useCallback(
    (alert: ClubAlert) => {
      if (alert.alertId) {
        void send("PATCH", `/alerts/${alert.alertId}`, { is_resolved: true, by });
        return;
      }
      // Keep a week of them for Resolved This Week.
      const weekAgo = new Date(new Date(`${day.date}T12:00:00Z`).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
      setResolutions((current) => [
        { ...nowStamp(), key: alert.key, label: alert.label, bucketLabel: alert.bucketLabel, date: day.date },
        ...current.filter((item) => item.date > weekAgo),
      ]);
    },
    [send, by, setResolutions, nowStamp, day.date],
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
      acks,
      acknowledge,
      unacknowledge,
      resolutions,
      resolve,
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
      acks,
      acknowledge,
      unacknowledge,
      resolutions,
      resolve,
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

/** Live alerts split by where they are in the Active / Acknowledged / Resolved flow. */
export function useAlerts() {
  const { day } = useLive();
  const { thresholds, seasons } = useClubSettings();
  const stations = useStationCards();
  const { acks, resolutions, maintenance } = useStationState();

  return useMemo(() => {
    const resolvedToday = new Set(resolutions.filter((item) => item.date === day.date).map((item) => item.key));
    // Freeze and heat warnings only matter while sap is running.
    const inSeason = seasonPhase(day.date, seasons)?.kind === "during";
    const live = [...(inSeason ? getWeatherAlerts(day, thresholds) : []), ...stations.flatMap((station) => station.alerts)]
      .filter((alert) => !resolvedToday.has(alert.key))
      .sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"));

    const stampFor = (alert: ClubAlert): AlertStamp | undefined =>
      alert.alertId
        ? alert.acknowledgedAt
          ? { by: alert.acknowledgedBy || "Someone", at: stampOf(alert.acknowledgedAt) }
          : undefined
        : acks[alert.key];
    const allAcks: Record<string, AlertStamp> = {};
    for (const alert of live) {
      const stamp = stampFor(alert);
      if (stamp) allAcks[alert.key] = stamp;
    }

    const active = live.filter((alert) => !allAcks[alert.key]);
    const acknowledged = live.filter((alert) => allAcks[alert.key]);

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

    return { active, acknowledged, maintenanceAlerts, acks: allAcks };
  }, [day, thresholds, seasons, stations, acks, resolutions, maintenance]);
}
