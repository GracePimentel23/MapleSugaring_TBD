"use client";

import { useState } from "react";
import {
  useBatchState,
  type BatchEditStamp,
  type BatchView,
} from "@/components/data/BatchStateProvider";
import { NotesList } from "@/components/stations/StationForms";
import { batchStatusStyles as statusStyles } from "@/lib/batchStatus";
import { canManage, currentUser, formatNoteTimestamp } from "@/lib/data/stationNotes";
import type { DemoDay } from "@/lib/demo/timeline";
import type { Batch, UserRole } from "@/lib/types/schema";

/** Notes shown on a batch before "See more". */
const VISIBLE_NOTES = 2;

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-gray-50"
      style={{ borderColor: "var(--color-border)" }}
    >
      Edit
    </button>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The two newest notes, with the rest behind "See more". */
function BatchNotes({ view }: { view: BatchView }) {
  const [showAll, setShowAll] = useState(false);
  const hidden = view.notes.length - VISIBLE_NOTES;

  if (view.notes.length === 0 && !view.lastEdited) return null;

  return (
    <div className="mt-3">
      {view.notes.length > 0 ? (
        <>
          <p className="mb-2 text-xs font-semibold">Notes</p>
          <NotesList notes={showAll ? view.notes : view.notes.slice(0, VISIBLE_NOTES)} />
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="mt-2 text-xs font-medium text-accent hover:underline"
            >
              {showAll ? "Show less" : `See more (${hidden} older note${hidden === 1 ? "" : "s"})`}
            </button>
          ) : null}
        </>
      ) : null}
      {view.lastEdited ? (
        <p className="mt-2 text-[11px] text-muted">
          Last edited by {view.lastEdited.by} · {view.lastEdited.at}
        </p>
      ) : null}
    </div>
  );
}

function BatchDetails({ view }: { view: BatchView }) {
  const { batch } = view;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Sap In", value: `${batch.sapInLbs} lbs` },
          {
            label: "Syrup Out",
            value: batch.syrupOutLbs > 0 ? `${batch.syrupOutLbs} lbs` : "—",
          },
          { label: "Brix", value: batch.brix > 0 ? `${batch.brix}°` : "—" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl p-2.5"
            style={{ background: "var(--color-bg)" }}
          >
            <div className="mb-0.5 text-xs text-muted">{item.label}</div>
            <div className="font-sans text-sm font-bold">{item.value}</div>
          </div>
        ))}
      </div>

      {batch.status === "completed" && batch.syrupOutLbs > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          ⚖️ Ratio:{" "}
          <strong className="text-text">
            {(batch.sapInLbs / batch.syrupOutLbs).toFixed(1)}:1
          </strong>
        </div>
      ) : null}

      <BatchNotes view={view} />
    </>
  );
}

function BatchCard({ view, onEdit }: { view: BatchView; onEdit: (() => void) | null }) {
  const { batch } = view;
  const style = statusStyles[batch.status];

  return (
    <div
      className="rounded-2xl bg-white px-4 py-4 shadow-sm"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <span className="font-sans text-sm font-bold">{batch.batchNumber}</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: style.bg, color: style.color }}
            >
              {style.label}
            </span>
          </div>
          <div className="text-xs text-muted">
            {formatDate(batch.date)} · {batch.createdBy}
          </div>
        </div>
        {onEdit ? <EditButton onClick={onEdit} /> : null}
      </div>

      <BatchDetails view={view} />
    </div>
  );
}

/** Completed batches collapse to a summary row, like the Collections list. */
function CompletedBatchRow({ view, onEdit }: { view: BatchView; onEdit: (() => void) | null }) {
  const [open, setOpen] = useState(false);
  const { batch } = view;
  const style = statusStyles.completed;

  return (
    <div
      className="overflow-hidden rounded-2xl bg-white shadow-sm"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <div className="flex w-full items-center justify-between px-4 py-3.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <div className="mb-0.5 flex items-center gap-2">
            <span className="font-sans text-sm font-bold">{batch.batchNumber}</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: style.bg, color: style.color }}
            >
              {style.label}
            </span>
          </div>
          <div className="text-xs text-muted">
            {formatDate(batch.date)} · {batch.sapInLbs} lbs in
            {batch.syrupOutLbs > 0 ? ` · ${batch.syrupOutLbs} lbs syrup` : ""}
          </div>
        </button>
        <div className="ml-3 flex shrink-0 items-center gap-3">
          {onEdit ? <EditButton onClick={onEdit} /> : null}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-muted"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronIcon open={open} />
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
          <div className="mb-2 text-xs text-muted">Created by {batch.createdBy}</div>
          <BatchDetails view={view} />
        </div>
      ) : null}
    </div>
  );
}

const fieldClass = "w-full rounded-xl border px-3 py-2 text-sm outline-none";

/** Everything from Create Batch, plus a note. Each save is stamped with who and when. */
function EditBatchModal({
  view,
  day,
  onClose,
}: {
  view: BatchView;
  day: DemoDay;
  onClose: () => void;
}) {
  const { saveBatch } = useBatchState();
  const { batch } = view;
  const [date, setDate] = useState(batch.date);
  const [sapIn, setSapIn] = useState(String(batch.sapInLbs));
  const [syrupOut, setSyrupOut] = useState(String(batch.syrupOutLbs));
  const [brix, setBrix] = useState(String(batch.brix));
  const [note, setNote] = useState("");

  function numberOr(value: string, fallback: number): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function save() {
    const stamp: BatchEditStamp = {
      by: currentUser.name,
      at: formatNoteTimestamp(day.date, new Date()),
    };
    const text = note.trim();
    saveBatch(
      batch.batchNumber,
      {
        date: date || batch.date,
        sapInLbs: numberOr(sapIn, batch.sapInLbs),
        syrupOutLbs: numberOr(syrupOut, batch.syrupOutLbs),
        brix: numberOr(brix, batch.brix),
      },
      text ? { text, author: stamp.by, createdAt: stamp.at } : null,
      stamp,
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:max-w-md md:rounded-2xl"
        style={{ maxHeight: "92vh" }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-4">
          <h3 className="font-sans text-base font-semibold">Edit {batch.batchNumber}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Sap In (lbs)</label>
            <input
              type="number"
              value={sapIn}
              onChange={(event) => setSapIn(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Syrup Out (lbs)
              </label>
              <input
                type="number"
                value={syrupOut}
                onChange={(event) => setSyrupOut(event.target.value)}
                className={fieldClass}
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Brix (°)</label>
              <input
                type="number"
                value={brix}
                onChange={(event) => setBrix(event.target.value)}
                className={fieldClass}
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Add a note</label>
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Boil progress, quality, anything worth remembering…"
              className={`${fieldClass} resize-none`}
              style={{ borderColor: "var(--color-border)" }}
            />
            <p className="mt-1 text-[11px] text-muted">
              Saved as {currentUser.name} ·{" "}
              {formatNoteTimestamp(day.date, new Date()).replace(/ at .*/, "")}
            </p>
          </div>
          {view.notes.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold">Previous notes</p>
              <NotesList notes={view.notes} />
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex shrink-0 gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 font-sans text-sm font-semibold"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateBatchModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-md md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-sans text-base font-semibold">Create Batch</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date</label>
            <input
              type="date"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Sap In (lbs)
            </label>
            <input
              type="number"
              placeholder="0.0"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Syrup Out (lbs)
              </label>
              <input
                type="number"
                placeholder="0.0"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Brix (°)</label>
              <input
                type="number"
                placeholder="66.0"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Notes</label>
            <textarea
              rows={2}
              className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 font-sans text-sm font-semibold"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Save Batch
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Batches({ day, role }: { day: DemoDay; role: UserRole }) {
  const { viewBatch } = useBatchState();
  const [showAdd, setShowAdd] = useState(false);
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const isAdmin = role === "admin";

  const views = day.batches.map(viewBatch);
  const batches = views.map((view) => view.batch);
  const viewOf = (batch: Batch) => views.find((view) => view.batch.id === batch.id)!;

  // Finished batches are locked to managers and IT; open ones anyone with edit
  // rights can update.
  function editHandler(batch: Batch): (() => void) | null {
    if (!isAdmin) return null;
    if (batch.status === "completed" && !canManage(currentUser.role)) return null;
    return () => setEditingBatch(batch.batchNumber);
  }

  const editingView = views.find((view) => view.batch.batchNumber === editingBatch) ?? null;
  const activeBatches = batches.filter(
    (batch) => batch.status === "active" || batch.status === "processing",
  );
  const waitingBatches = batches.filter((batch) => batch.status === "waiting");
  const doneBatches = batches.filter((batch) => batch.status === "completed");

  const totalSyrup = doneBatches.reduce((sum, batch) => sum + batch.syrupOutLbs, 0);
  const totalSap = batches.reduce((sum, batch) => sum + batch.sapInLbs, 0);
  const avgBrix = doneBatches.length
    ? doneBatches.reduce((sum, batch) => sum + batch.brix, 0) / doneBatches.length
    : 0;

  return (
    <div className="w-full p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            {batches.length} batch{batches.length === 1 ? "" : "es"} this season
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            <span className="text-base leading-none">+</span> New Batch
          </button>
        ) : null}
      </div>

      {batches.length === 0 ? (
        <div className="py-16 text-center text-muted">
          <div className="mb-3 text-4xl">🍯</div>
          <p className="text-sm font-medium">No batches yet</p>
          <p className="mt-1 text-xs">
            A batch is created once sap has been collected into storage.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: "Total Sap In", value: `${totalSap.toFixed(1)} lbs` },
              { label: "Syrup Produced", value: `${totalSyrup.toFixed(1)} lbs` },
              {
                label: "Avg Brix",
                value: avgBrix > 0 ? `${avgBrix.toFixed(1)}°` : "—",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-white px-3 py-3 shadow-sm"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <div className="mb-0.5 text-xs text-muted">{item.label}</div>
                <div className="font-sans text-lg font-bold">{item.value}</div>
              </div>
            ))}
          </div>

          {activeBatches.length > 0 ? (
            <div className="mb-5">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "var(--color-accent-light)",
                  border: "1.5px solid rgba(74,122,51,0.22)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: "#6B9E45" }} />
                  <h3 className="font-sans text-sm font-semibold">Collecting &amp; Boiling</h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "rgba(255,255,255,0.7)", color: "#4A7A33" }}
                  >
                    {activeBatches.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {activeBatches.map((batch) => (
                    <BatchCard key={batch.id} view={viewOf(batch)} onEdit={editHandler(batch)} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {waitingBatches.length > 0 ? (
            <div className="mb-5">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "rgba(107,114,128,0.06)",
                  border: "1.5px solid rgba(107,114,128,0.2)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">⏳</span>
                  <h3 className="font-sans text-sm font-semibold">Waiting / Storage</h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "rgba(107,114,128,0.12)", color: "#6B7280" }}
                  >
                    {waitingBatches.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {waitingBatches.map((batch) => (
                    <BatchCard key={batch.id} view={viewOf(batch)} onEdit={editHandler(batch)} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {doneBatches.length > 0 ? (
            <div>
              <h3 className="mb-3 font-sans text-sm font-semibold text-muted">
                Completed
              </h3>
              <div className="flex flex-col gap-2">
                {doneBatches.map((batch) => (
                  <CompletedBatchRow
                    key={batch.id}
                    view={viewOf(batch)}
                    onEdit={editHandler(batch)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {showAdd && isAdmin ? <CreateBatchModal onClose={() => setShowAdd(false)} /> : null}
      {editingView ? (
        <EditBatchModal
          key={editingView.batch.batchNumber}
          view={editingView}
          day={day}
          onClose={() => setEditingBatch(null)}
        />
      ) : null}
    </div>
  );
}
