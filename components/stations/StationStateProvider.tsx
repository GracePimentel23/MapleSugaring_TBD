"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { canManage, currentUser, seedStationNotes } from "@/lib/data/stationNotes";
import { getStationCards } from "@/lib/selectors/stations";
import type { StationNote, StationView } from "@/lib/types/schema";

/** Someone switched a station into or out of maintenance. Newest first. */
export interface MaintenanceEvent {
  id: number;
  bucketId: number;
  entering: boolean;
  by: string;
  /** "1:18 PM" */
  time: string;
}

interface StationStateValue {
  maintenance: ReadonlySet<number>;
  maintenanceEvents: MaintenanceEvent[];
  toggleMaintenance: (bucketId: number) => void;
  notes: Record<number, StationNote[]>;
  addNote: (bucketId: number, note: StationNote) => void;
  /** Set when a notification is clicked, so the Stations page can jump to it */
  focusedBucketId: number | null;
  focusStation: (bucketId: number) => void;
  clearFocus: () => void;
}

const StationStateContext = createContext<StationStateValue | null>(null);

/**
 * Admin-side station state that lives outside the timeline. Unlike the demo's
 * day data, it carries across days: a station stays in maintenance and its
 * notes stay on the bucket until someone changes them.
 */
export default function StationStateProvider({ children }: { children: ReactNode }) {
  const [maintenance, setMaintenance] = useState<ReadonlySet<number>>(() => new Set());
  const [maintenanceEvents, setMaintenanceEvents] = useState<MaintenanceEvent[]>([]);
  const [notes, setNotes] = useState<Record<number, StationNote[]>>(seedStationNotes);
  const [focusedBucketId, setFocusedBucketId] = useState<number | null>(null);

  const toggleMaintenance = useCallback(
    (bucketId: number) => {
      // Only managers and IT can flip this; the UI hides the toggle for others.
      if (!canManage(currentUser.role)) return;

      const entering = !maintenance.has(bucketId);
      const nextSet = new Set(maintenance);
      if (entering) nextSet.add(bucketId);
      else nextSet.delete(bucketId);
      setMaintenance(nextSet);

      setMaintenanceEvents((current) => [
        {
          id: (current[0]?.id ?? 0) + 1,
          bucketId,
          entering,
          by: currentUser.name,
          time: new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
        },
        ...current,
      ]);
    },
    [maintenance],
  );

  const addNote = useCallback((bucketId: number, note: StationNote) => {
    setNotes((current) => ({
      ...current,
      [bucketId]: [note, ...(current[bucketId] ?? [])],
    }));
  }, []);

  const focusStation = useCallback((bucketId: number) => setFocusedBucketId(bucketId), []);
  const clearFocus = useCallback(() => setFocusedBucketId(null), []);

  const value = useMemo<StationStateValue>(
    () => ({
      maintenance,
      maintenanceEvents,
      toggleMaintenance,
      notes,
      addNote,
      focusedBucketId,
      focusStation,
      clearFocus,
    }),
    [maintenance, maintenanceEvents, toggleMaintenance, notes, addNote, focusedBucketId, focusStation, clearFocus],
  );

  return (
    <StationStateContext.Provider value={value}>{children}</StationStateContext.Provider>
  );
}

export function useStationState(): StationStateValue {
  const context = useContext(StationStateContext);
  if (!context) {
    throw new Error("useStationState must be used inside StationStateProvider");
  }
  return context;
}

/** Today's station cards with maintenance and notes applied. */
export function useStationCards(): StationView[] {
  const { day } = useDemo();
  const { maintenance, notes } = useStationState();
  return useMemo(() => getStationCards(day, { maintenance, notes }), [day, maintenance, notes]);
}
