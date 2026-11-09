"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLive } from "@/components/live/LiveProvider";
import { useSession } from "@/components/session/SessionProvider";
import { longDate, noteStamp } from "@/lib/time";
import type { Batch, BatchStatus, StationNote } from "@/lib/types/schema";

/**
 * Fields a user can change on a batch. The date is when it was started and never changes; sap in is
 * the total of its collections; syrup out, Brix and boil time are entered when it is completed.
 */
export interface BatchEdit {
  status?: BatchStatus;
  /** The batch's full list of collections ("c3") */
  collectionIds?: string[];
  syrupOutLbs?: number;
  brix?: number;
  boilMinutes?: number;
}

/** A new batch is started from collections already logged; it starts Collecting, today. */
export interface NewBatch {
  collectionIds: string[];
  notes: string;
}

export interface BatchEditStamp {
  by: string;
  at: string;
}

/** A batch as shown on screen, with its notes. */
export interface BatchView {
  /** Sap in is the total of its collections, when it has any */
  batch: Batch;
  /** The collections in it ("c3"): each collection names its batch */
  collectionIds: string[];
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
  const { day, notes, send, call } = useLive();
  const { user } = useSession();

  /** The collections whose batch is this one, oldest first. */
  const collectionsOf = useCallback(
    (batch: Batch) =>
      day.collections
        .filter((collection) => collection.batchName === batch.batchNumber)
        .sort((a, b) => a.collectionNumber - b.collectionNumber),
    [day.collections],
  );

  /** Moves collections into (or, with null, out of) a batch: each collection names its batch. */
  const assign = useCallback(
    async (collectionIds: string[], batchId: string | null) => {
      for (const id of collectionIds) {
        if (!(await send("PATCH", `/collections/${id}`, { batchId, by: user.name }))) return false;
      }
      return true;
    },
    [send, user.name],
  );

  const saveBatch = useCallback<BatchStateValue["saveBatch"]>(
    async (batch, { collectionIds, ...edit }, note) => {
      if (collectionIds) {
        const current = collectionsOf(batch).map((collection) => collection.id);
        const added = collectionIds.filter((id) => !current.includes(id));
        const removed = current.filter((id) => !collectionIds.includes(id));
        if (!(await assign(added, batch.id)) || !(await assign(removed, null))) return false;
      }
      const saved = await send("PATCH", `/batches/${batch.id}`, { ...edit, by: user.name });
      if (saved && note.trim()) {
        return send("POST", "/notes", { subject: "batch", subjectId: batch.id, text: note.trim(), by: user.name });
      }
      return saved;
    },
    [send, user.name, collectionsOf, assign],
  );

  // Start the batch, then point each chosen collection at it; its sap in is their total.
  const createBatch = useCallback<BatchStateValue["createBatch"]>(
    async (batch) => {
      const created = await call<{ id: string }>("POST", "/batches", {
        status: "active",
        notes: batch.notes || undefined,
        createdBy: user.name,
        by: user.name,
      });
      return created ? assign(batch.collectionIds, created.id) : false;
    },
    [call, user.name, assign],
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
      const mine = collectionsOf(batch);
      const sapInLbs = mine.length
        ? Math.round(mine.reduce((sum, collection) => sum + collection.totalLbs, 0) * 10) / 10
        : batch.sapInLbs;
      return {
        batch: { ...batch, sapInLbs },
        collectionIds: mine.map((collection) => collection.id),
        notes: [...added, ...first],
        lastEdited: null,
      };
    },
    [notes, collectionsOf],
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
