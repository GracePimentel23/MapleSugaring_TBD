"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLive } from "@/components/live/LiveProvider";
import { useSession } from "@/components/session/SessionProvider";
import { longDate, noteStamp } from "@/lib/time";
import type { Batch, BatchStatus, StationNote } from "@/lib/types/schema";

/** Fields a user can change from the batch Edit sheet. */
export interface BatchEdit {
  date: string;
  sapInLbs: number;
  syrupOutLbs: number;
  brix: number;
  status?: BatchStatus;
}

export interface NewBatch {
  date: string;
  sapInLbs: number | null;
  syrupOutLbs: number;
  brix: number;
  notes: string;
}

export interface BatchEditStamp {
  by: string;
  at: string;
}

/** A batch as shown on screen, with its notes. */
export interface BatchView {
  batch: Batch;
  /** Newest first */
  notes: StationNote[];
  lastEdited: BatchEditStamp | null;
}

interface BatchStateValue {
  saveBatch: (batch: Batch, edit: BatchEdit, note: string) => Promise<boolean>;
  createBatch: (batch: NewBatch) => Promise<boolean>;
  viewBatch: (batch: Batch) => BatchView;
}

const BatchStateContext = createContext<BatchStateValue | null>(null);

/**
 * Batches come from the worker (GET /batches); edits go back with PATCH /batches/:id and notes with
 * POST /notes. The batch's own notes field (set when it was created) shows as its first note.
 */
export default function BatchStateProvider({ children }: { children: ReactNode }) {
  const { notes, send } = useLive();
  const { user } = useSession();

  const saveBatch = useCallback<BatchStateValue["saveBatch"]>(
    async (batch, edit, note) => {
      const saved = await send("PATCH", `/batches/${batch.id}`, { ...edit, by: user.name });
      if (saved && note.trim()) {
        return send("POST", "/notes", { subject: "batch", subjectId: batch.id, text: note.trim(), by: user.name });
      }
      return saved;
    },
    [send, user.name],
  );

  const createBatch = useCallback<BatchStateValue["createBatch"]>(
    (batch) =>
      send("POST", "/batches", {
        date: batch.date || undefined,
        sapInLbs: batch.sapInLbs ?? undefined,
        syrupOutLbs: batch.syrupOutLbs,
        brix: batch.brix,
        notes: batch.notes || undefined,
        createdBy: user.name,
        by: user.name,
      }),
    [send, user.name],
  );

  const viewBatch = useCallback(
    (batch: Batch): BatchView => {
      const added = (notes.batch[batch.id.replace(/^b/, "")] ?? []).map((note) => {
        const at = new Date(note.createdAt);
        const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(at);
        return { id: note.id, text: note.text, author: note.author || "Someone", createdAt: noteStamp(day, at) };
      });
      const first: StationNote[] = batch.notes
        ? [{ text: batch.notes, author: batch.createdBy || "Someone", createdAt: longDate(batch.date) }]
        : [];
      return { batch, notes: [...added, ...first], lastEdited: null };
    },
    [notes],
  );

  const value = useMemo(() => ({ saveBatch, createBatch, viewBatch }), [saveBatch, createBatch, viewBatch]);

  return <BatchStateContext.Provider value={value}>{children}</BatchStateContext.Provider>;
}

export function useBatchState(): BatchStateValue {
  const context = useContext(BatchStateContext);
  if (!context) {
    throw new Error("useBatchState must be used inside BatchStateProvider");
  }
  return context;
}
