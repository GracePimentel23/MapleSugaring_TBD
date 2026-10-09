"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Batch, StationNote } from "@/lib/types/schema";

/** Fields a user can change from the batch Edit sheet. */
export interface BatchEdit {
  date: string;
  sapInLbs: number;
  syrupOutLbs: number;
  brix: number;
}

export interface BatchEditStamp {
  by: string;
  at: string;
}

/** A batch as shown on screen: timeline data with user edits and notes applied. */
export interface BatchView {
  batch: Batch;
  /** Newest first */
  notes: StationNote[];
  lastEdited: BatchEditStamp | null;
}

interface BatchStateValue {
  saveBatch: (
    batchNumber: string,
    edit: BatchEdit,
    note: StationNote | null,
    stamp: BatchEditStamp,
  ) => void;
  viewBatch: (batch: Batch) => BatchView;
}

const BatchStateContext = createContext<BatchStateValue | null>(null);

/** "2022-03-08" -> "Mar 8, 2022" */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The timeline gives each batch stage one plain-text note. Present it as a note
 * from whoever created the batch, so it lists alongside notes users add.
 */
function timelineNote(batch: Batch): StationNote | null {
  if (!batch.notes) return null;
  return {
    text: batch.notes,
    author: batch.createdBy,
    createdAt: `${formatDate(batch.date)} at 8:00 AM`,
  };
}

/**
 * Batch edits and notes made in the app. Keyed by batch number so they carry
 * across demo days and survive moving between pages.
 */
export default function BatchStateProvider({ children }: { children: ReactNode }) {
  const [edits, setEdits] = useState<Record<string, BatchEdit>>({});
  const [notes, setNotes] = useState<Record<string, StationNote[]>>({});
  const [stamps, setStamps] = useState<Record<string, BatchEditStamp>>({});

  const saveBatch = useCallback<BatchStateValue["saveBatch"]>(
    (batchNumber, edit, note, stamp) => {
      setEdits((current) => ({ ...current, [batchNumber]: edit }));
      setStamps((current) => ({ ...current, [batchNumber]: stamp }));
      if (note) {
        setNotes((current) => ({
          ...current,
          [batchNumber]: [note, ...(current[batchNumber] ?? [])],
        }));
      }
    },
    [],
  );

  const viewBatch = useCallback(
    (batch: Batch): BatchView => {
      const edit = edits[batch.batchNumber];
      const seed = timelineNote(batch);
      return {
        batch: edit ? { ...batch, ...edit } : batch,
        notes: [...(notes[batch.batchNumber] ?? []), ...(seed ? [seed] : [])],
        lastEdited: stamps[batch.batchNumber] ?? null,
      };
    },
    [edits, notes, stamps],
  );

  const value = useMemo(() => ({ saveBatch, viewBatch }), [saveBatch, viewBatch]);

  return <BatchStateContext.Provider value={value}>{children}</BatchStateContext.Provider>;
}

export function useBatchState(): BatchStateValue {
  const context = useContext(BatchStateContext);
  if (!context) {
    throw new Error("useBatchState must be used inside BatchStateProvider");
  }
  return context;
}
