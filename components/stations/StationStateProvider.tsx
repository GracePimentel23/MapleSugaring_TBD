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
import { useDemo } from "@/components/demo/DemoProvider";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { seedStationNotes } from "@/lib/data/stationNotes";
import { getStationCards, getWeatherAlerts, type TreeEdit } from "@/lib/selectors/stations";
import { clockTime, tableStamp } from "@/lib/time";
import type { ClubAlert, StationNote, StationView } from "@/lib/types/schema";

export interface MaintenanceEntry {
  by: string;
  startedAt: number;
  endsAt: number;
}

/** A collection logged through the app (Log collection flow). */
export interface LoggedCollection {
  id: number;
  dayIndex: number;
  bucketId: number;
  bucketName: string;
  lbs: number;
  batchNumber: string;
  collectedBy: string;
  /** "Mar 11, 9:40 AM" */
  when: string;
  note: string;
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
  dayIndex: number;
}

interface StationStateValue {
  maintenance: Record<number, MaintenanceEntry>;
  toggleMaintenance: (bucketId: number) => void;
  extendMaintenance: (bucketId: number) => void;
  notes: Record<number, StationNote[]>;
  addNote: (bucketId: number, note: StationNote) => void;
  treeEdits: Record<number, TreeEdit>;
  editTree: (bucketId: number, edit: TreeEdit) => void;
  retired: ReadonlySet<number>;
  retireTree: (bucketId: number) => void;
  loggedCollections: LoggedCollection[];
  logCollection: (entry: Omit<LoggedCollection, "id" | "dayIndex">) => void;
  acks: Record<string, AlertStamp>;
  acknowledge: (alert: ClubAlert) => void;
  /** Take back an acknowledgement, e.g. from Undo */
  unacknowledge: (key: string) => void;
  resolutions: UserResolution[];
  resolve: (alert: ClubAlert) => void;
  /** Set when an alert is opened, so the Stations page can jump to it */
  focusedBucketId: number | null;
  focusStation: (bucketId: number) => void;
  clearFocus: () => void;
}

const StationStateContext = createContext<StationStateValue | null>(null);

const HOUR_MS = 3_600_000;

/**
 * Station state that lives outside the timeline. Unlike the demo's day data,
 * it carries across days: maintenance, notes, tree edits and alert
 * acknowledgements stay until someone changes them.
 */
export default function StationStateProvider({ children }: { children: ReactNode }) {
  const { day, dayIndex } = useDemo();
  const { user, can, logAudit } = useSession();
  const { maintenanceDefaults } = useClubSettings();

  const [maintenance, setMaintenance] = useState<Record<number, MaintenanceEntry>>({});
  const [notes, setNotes] = useState<Record<number, StationNote[]>>(seedStationNotes);
  const [treeEdits, setTreeEdits] = useState<Record<number, TreeEdit>>({});
  const [retired, setRetired] = useState<ReadonlySet<number>>(() => new Set());
  const [loggedCollections, setLoggedCollections] = useState<LoggedCollection[]>([]);
  const [acks, setAcks] = useState<Record<string, AlertStamp>>({});
  const [resolutions, setResolutions] = useState<UserResolution[]>([]);
  const [focusedBucketId, setFocusedBucketId] = useState<number | null>(null);

  const stamp = useCallback((): AlertStamp => ({ by: user.name, at: tableStamp(day.date) }), [user.name, day.date]);

  // Maintenance switches itself off after the configured time.
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setMaintenance((current) => {
        const expired = Object.entries(current).filter(([, entry]) => entry.endsAt <= now);
        if (expired.length === 0) return current;
        const next = { ...current };
        for (const [bucketId] of expired) delete next[Number(bucketId)];
        return next;
      });
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const toggleMaintenance = useCallback(
    (bucketId: number) => {
      if (!can("stations:maintenance")) return;
      const turningOn = !maintenance[bucketId];
      setMaintenance((current) => {
        const next = { ...current };
        if (turningOn) {
          const now = Date.now();
          next[bucketId] = {
            by: user.name,
            startedAt: now,
            endsAt: now + maintenanceDefaults.autoOffHours * HOUR_MS,
          };
        } else {
          delete next[bucketId];
        }
        return next;
      });
      logAudit({
        when: tableStamp(day.date),
        action: turningOn ? "Maintenance mode on" : "Maintenance mode off",
        record: `Bucket #${String(bucketId).padStart(2, "0")}`,
        change: turningOn ? `Switches off after ${maintenanceDefaults.autoOffHours} h` : "Alerts resumed",
      });
    },
    [can, maintenance, user.name, maintenanceDefaults.autoOffHours, logAudit, day.date],
  );

  const extendMaintenance = useCallback(
    (bucketId: number) => {
      setMaintenance((current) => {
        const entry = current[bucketId];
        if (!entry) return current;
        return { ...current, [bucketId]: { ...entry, endsAt: entry.endsAt + HOUR_MS } };
      });
      logAudit({
        when: tableStamp(day.date),
        action: "Extended maintenance",
        record: `Bucket #${String(bucketId).padStart(2, "0")}`,
        change: "+1 hour",
      });
    },
    [logAudit, day.date],
  );

  const addNote = useCallback((bucketId: number, note: StationNote) => {
    setNotes((current) => ({
      ...current,
      [bucketId]: [note, ...(current[bucketId] ?? [])],
    }));
  }, []);

  const editTree = useCallback(
    (bucketId: number, edit: TreeEdit) => {
      setTreeEdits((current) => ({ ...current, [bucketId]: { ...current[bucketId], ...edit } }));
      logAudit({
        when: tableStamp(day.date),
        action: "Edited tree and sensor",
        record: `Bucket #${String(bucketId).padStart(2, "0")}`,
        change: [edit.treeLabel, edit.treeSpecies, edit.sensorId].filter(Boolean).join(", "),
      });
    },
    [logAudit, day.date],
  );

  const retireTree = useCallback(
    (bucketId: number) => {
      setRetired((current) => new Set(current).add(bucketId));
      logAudit({
        when: tableStamp(day.date),
        action: "Retired tree",
        record: `Bucket #${String(bucketId).padStart(2, "0")}`,
        change: "Hidden, data kept",
      });
    },
    [logAudit, day.date],
  );

  const logCollection = useCallback(
    (entry: Omit<LoggedCollection, "id" | "dayIndex">) => {
      setLoggedCollections((current) => [
        { ...entry, id: (current[0]?.id ?? 0) + 1, dayIndex },
        ...current,
      ]);
      logAudit({
        when: tableStamp(day.date),
        action: "Logged collection",
        record: `${entry.bucketName}, ${entry.batchNumber}`,
        change: `${entry.lbs} lbs`,
      });
    },
    [dayIndex, logAudit, day.date],
  );

  const acknowledge = useCallback(
    (alert: ClubAlert) => setAcks((current) => ({ ...current, [alert.key]: stamp() })),
    [stamp],
  );

  const unacknowledge = useCallback((key: string) => {
    setAcks((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const resolve = useCallback(
    (alert: ClubAlert) => {
      setResolutions((current) => [
        {
          ...stamp(),
          key: alert.key,
          label: alert.label,
          bucketLabel: alert.bucketLabel,
          dayIndex,
        },
        ...current,
      ]);
    },
    [stamp, dayIndex],
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
      treeEdits,
      editTree,
      retired,
      retireTree,
      loggedCollections,
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
      treeEdits,
      editTree,
      retired,
      retireTree,
      loggedCollections,
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

/** Today's station cards (retired trees hidden) with every override applied. */
export function useStationCards(options: { includeRetired?: boolean } = {}): StationView[] {
  const { day, dayIndex } = useDemo();
  const { thresholds } = useClubSettings();
  const { maintenance, notes, treeEdits, retired, loggedCollections } = useStationState();
  const includeRetired = options.includeRetired ?? false;

  return useMemo(() => {
    const loggedToday = new Set(
      loggedCollections
        .filter((entry) => entry.dayIndex === dayIndex)
        .map((entry) => entry.bucketId),
    );
    const cards = getStationCards(
      day,
      {
        maintenance: new Set(Object.keys(maintenance).map(Number)),
        notes,
        treeEdits,
        loggedToday,
      },
      thresholds,
    );
    return includeRetired ? cards : cards.filter((card) => !retired.has(card.bucketId));
  }, [day, dayIndex, thresholds, maintenance, notes, treeEdits, retired, loggedCollections, includeRetired]);
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
  const { day, dayIndex } = useDemo();
  const { thresholds } = useClubSettings();
  const stations = useStationCards();
  const { acks, resolutions, maintenance } = useStationState();

  return useMemo(() => {
    const resolvedToday = new Set(
      resolutions.filter((item) => item.dayIndex === dayIndex).map((item) => item.key),
    );
    const live = [
      ...getWeatherAlerts(day, thresholds),
      ...stations.flatMap((station) => station.alerts),
    ]
      .filter((alert) => !resolvedToday.has(alert.key))
      .sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"));

    const active = live.filter((alert) => !acks[alert.key]);
    const acknowledged = live.filter((alert) => acks[alert.key]);

    const maintenanceAlerts: MaintenanceAlert[] = Object.entries(maintenance).flatMap(
      ([bucketId, entry]) => {
        const station = stations.find((item) => item.bucketId === Number(bucketId));
        if (!station) return [];
        return [
          {
            bucketId: Number(bucketId),
            station,
            entry,
            endsLabel: clockTime(new Date(entry.endsAt)),
            startedLabel: clockTime(new Date(entry.startedAt)),
          },
        ];
      },
    );

    return { active, acknowledged, maintenanceAlerts, acks };
  }, [day, dayIndex, thresholds, stations, acks, resolutions, maintenance]);
}
