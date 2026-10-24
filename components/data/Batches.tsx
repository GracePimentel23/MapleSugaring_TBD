"use client";

import { useState } from "react";
import { useBatchState, type BatchEditStamp, type BatchView } from "@/components/data/BatchStateProvider";
import { DropIcon, MoreIcon, PencilIcon, PlusIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { NotesList } from "@/components/stations/StationForms";
import {
  Button,
  Card,
  cx,
  DataTable,
  EmptyState,
  Field,
  inputClass,
  Modal,
  PageHeader,
  StatCard,
} from "@/components/ui/ui";
import { batchStatusLabel } from "@/lib/batchStatus";
import type { DemoDay } from "@/lib/demo/timeline";
import { monthDay, noteStamp, shortDate } from "@/lib/time";
import type { Batch, BatchStatus } from "@/lib/types/schema";

const stages = ["Collecting", "Boiling", "Finishing", "Closed"] as const;

/** Where each status sits on the four-stage track. Waiting is still before boiling. */
const stageIndex: Record<BatchStatus, number> = {
  waiting: 0,
  active: 0,
  processing: 1,
  completed: 3,
};

function formatDuration(minutes?: number): string {
  if (!minutes) return "—";
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function StageTrack({ status }: { status: BatchStatus }) {
  const current = stageIndex[status];
  return (
    <div className="grid grid-cols-4 gap-2 md:gap-4">
      {stages.map((stage, index) => (
        <div key={stage}>
          <div
            className="anim-grow h-2.5 rounded-full"
            style={{
              animationDelay: `${index * 140}ms`,
              // Stages already passed are pale green; the current one is stronger.
              background:
                index > current
                  ? "var(--color-progress-track)"
                  : index === current && current > 0
                    ? "#6FA867"
                    : "#A9C99F",
            }}
          />
          <div
            className={cx("mt-2 text-sm md:text-body", index === current ? "font-semibold text-text" : "text-muted")}
          >
            {stage}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The newest note as the batch's one-line status, with the full list behind a link. */
function BatchNotes({ view }: { view: BatchView }) {
  const [open, setOpen] = useState(false);
  const latest = view.notes[0];

  return (
    <div className="mt-4">
      {latest ? <p className="text-body text-muted">{latest.text}</p> : null}
      {view.notes.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-2 text-sm font-medium text-accent-mid hover:underline"
        >
          {open ? "Hide notes" : `See all notes (${view.notes.length})`}
        </button>
      ) : null}
      {open ? (
        <div className="mt-3">
          <NotesList notes={view.notes} />
        </div>
      ) : null}
      {view.lastEdited ? (
        <p className="mt-2 text-xs text-muted">
          Last edited by {view.lastEdited.by} · {view.lastEdited.at}
        </p>
      ) : null}
    </div>
  );
}

function OpenBatchCard({ view, onEdit }: { view: BatchView; onEdit: (() => void) | null }) {
  const { weight } = useClubSettings();
  const { batch } = view;

  return (
    <Card className="md:px-8 md:py-7">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="font-sans text-xl font-semibold md:text-2xl">{batch.batchNumber}</span>
            <span className="font-sans text-lg font-semibold text-accent-mid md:text-xl">
              {batchStatusLabel[batch.status]}
            </span>
          </div>
          <div className="mt-0.5 text-body text-muted">
            {monthDay(batch.date)} · {batch.createdBy}
          </div>
        </div>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${batch.batchNumber}`}
            className="rounded-lg p-2 text-text transition-colors hover:bg-bg"
          >
            <PencilIcon size={22} />
          </button>
        ) : null}
      </div>

      <div className="mb-5">
        <div className="text-body text-muted">Sap in</div>
        <div className="font-sans text-3xl font-bold md:text-4xl">{weight(batch.sapInLbs)}</div>
      </div>

      <StageTrack status={batch.status} />
      <BatchNotes view={view} />
    </Card>
  );
}

function ClosedRowMenu({ view, canEdit, onEdit }: { view: BatchView; canEdit: boolean; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`More for ${view.batch.batchNumber}`}
        className="rounded-lg p-1.5 hover:bg-bg"
      >
        <MoreIcon size={20} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 z-30 mt-1 w-56 rounded-xl border border-border bg-white p-1.5 text-left shadow-xl">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowNotes(true);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg"
            >
              View notes ({view.notes.length})
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg disabled:cursor-not-allowed disabled:text-muted"
            >
              {canEdit ? "Edit (override lock)" : "Edit · Owner / IT only"}
            </button>
          </div>
        </>
      ) : null}
      {showNotes ? (
        <Modal title={`${view.batch.batchNumber} notes`} onClose={() => setShowNotes(false)}>
          <div className="pb-6">
            {view.notes.length ? <NotesList notes={view.notes} /> : <p className="text-muted">No notes yet.</p>}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** Everything from New Batch, plus a note. Each save is stamped with who and when. */
function EditBatchModal({ view, day, onClose }: { view: BatchView; day: DemoDay; onClose: () => void }) {
  const { saveBatch } = useBatchState();
  const { user, logAudit } = useSession();
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
    const stamp: BatchEditStamp = { by: user.name, at: noteStamp(day.date) };
    const text = note.trim();
    const next = {
      date: date || batch.date,
      sapInLbs: numberOr(sapIn, batch.sapInLbs),
      syrupOutLbs: numberOr(syrupOut, batch.syrupOutLbs),
      brix: numberOr(brix, batch.brix),
    };
    saveBatch(batch.batchNumber, next, text ? { text, author: user.name, createdAt: stamp.at } : null, stamp);

    const changes = [
      next.syrupOutLbs !== batch.syrupOutLbs && `Syrup out: ${batch.syrupOutLbs || "—"} to ${next.syrupOutLbs} lbs`,
      next.brix !== batch.brix && `Brix: ${batch.brix || "—"}° to ${next.brix}°`,
      next.sapInLbs !== batch.sapInLbs && `Sap in: ${batch.sapInLbs} to ${next.sapInLbs} lbs`,
      text && "Added a note",
    ].filter(Boolean);
    logAudit({
      when: `${shortDate(day.date)}, ${stamp.at.split(" at ")[1]}`,
      action: batch.status === "completed" ? "Overrode closed batch" : "Edited batch",
      record: batch.batchNumber,
      change: changes.join("; ") || "No changes",
    });
    onClose();
  }

  return (
    <Modal
      title={`Edit ${batch.batchNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save Changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        {batch.status === "completed" ? (
          <p className="rounded-xl border border-attention-border bg-attention-bg px-4 py-2.5 text-sm">
            This batch is closed. Saving overrides the lock and is written to the audit log.
          </p>
        ) : null}
        <Field label="Date">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Sap in (lbs)">
          <input
            type="number"
            value={sapIn}
            onChange={(event) => setSapIn(event.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Syrup out (lbs)">
            <input
              type="number"
              value={syrupOut}
              onChange={(event) => setSyrupOut(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Brix (°)">
            <input
              type="number"
              value={brix}
              onChange={(event) => setBrix(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Add a note" hint={`Saved as ${user.name}, ${noteStamp(day.date)}`}>
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Boil progress, quality, anything worth remembering…"
            className={`${inputClass} resize-none`}
          />
        </Field>
        {view.notes.length > 0 ? (
          <div className="pb-2">
            <p className="mb-2 text-sm font-semibold">Previous notes</p>
            <NotesList notes={view.notes} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function NewBatchModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="New batch"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save Batch</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date">
          <input type="date" className={inputClass} />
        </Field>
        <Field label="Sap in (lbs)">
          <input type="number" placeholder="0.0" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Syrup out (lbs)">
            <input type="number" placeholder="0.0" className={inputClass} />
          </Field>
          <Field label="Brix (°)">
            <input type="number" placeholder="66.0" className={inputClass} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={3} className={`${inputClass} resize-none`} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Batches({ day }: { day: DemoDay }) {
  const { viewBatch } = useBatchState();
  const { can } = useSession();
  const { weight } = useClubSettings();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const views = day.batches.map(viewBatch);
  const batches = views.map((view) => view.batch);
  const open = views.filter((view) => view.batch.status !== "completed");
  const closed = views.filter((view) => view.batch.status === "completed");

  const closedBatches: Batch[] = closed.map((view) => view.batch);
  const totalSap = batches.reduce((sum, batch) => sum + batch.sapInLbs, 0);
  const syrup = closedBatches.reduce((sum, batch) => sum + batch.syrupOutLbs, 0);
  const closedSap = closedBatches.reduce((sum, batch) => sum + batch.sapInLbs, 0);
  const avgBrix = closedBatches.length
    ? closedBatches.reduce((sum, batch) => sum + batch.brix, 0) / closedBatches.length
    : 0;

  // Closed batches are locked to the Owner / IT; open ones follow the role's batch permission.
  function editHandler(batch: Batch): (() => void) | null {
    const allowed = batch.status === "completed" ? can("batches:editClosed") : can("batches:manage");
    return allowed ? () => setEditing(batch.batchNumber) : null;
  }

  const editingView = views.find((view) => view.batch.batchNumber === editing) ?? null;

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <PageHeader
        title="Batches"
        subtitle={`${batches.length} this season. Closed batches are locked unless an admin overrides.`}
        actions={
          can("batches:manage") ? (
            <Button onClick={() => setShowNew(true)}>
              <PlusIcon size={16} />
              New Batch
            </Button>
          ) : null
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          icon={<DropIcon size={26} />}
          title="No batches yet"
          description="A batch is created once sap has been collected into storage."
        />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total sap" value={weight(totalSap)} note="all batches" />
            <StatCard
              label="Syrup produced"
              value={weight(syrup)}
              note={`${closedBatches.length} batch${closedBatches.length === 1 ? "" : "es"} boiled`}
            />
            <StatCard label="Avg Brix" value={avgBrix ? `${avgBrix.toFixed(1)}°` : "—"} note="closed batches" />
            <StatCard
              label="Sap to syrup"
              value={syrup ? `${(closedSap / syrup).toFixed(1)} : 1` : "—"}
              note="closed batches only"
            />
          </div>

          {open.length > 0 ? (
            <section className="mb-8">
              <h2 className="mb-3 font-sans text-lg font-semibold max-md:pt-4">Open</h2>
              <div className="space-y-5">
                {open.map((view) => (
                  <OpenBatchCard key={view.batch.id} view={view} onEdit={editHandler(view.batch)} />
                ))}
              </div>
            </section>
          ) : null}

          {closed.length > 0 ? (
            <section>
              <h2 className="mb-3 font-sans text-lg font-semibold max-md:pt-4">Closed</h2>
              <Card className="md:px-7">
                <DataTable
                  columns={[
                    { key: "batch", label: "Batch" },
                    { key: "sapIn", label: "Sap in" },
                    { key: "syrup", label: "Syrup out" },
                    { key: "ratio", label: "Ratio" },
                    { key: "brix", label: "Brix" },
                    { key: "duration", label: "Duration" },
                    { key: "notes", label: "Notes", className: "max-w-[220px]" },
                    { key: "menu", label: "" },
                  ]}
                  rows={closed.map((view) => {
                    const { batch } = view;
                    return {
                      key: batch.id,
                      cells: {
                        batch: (
                          <div>
                            <div className="font-sans font-semibold">{batch.batchNumber}</div>
                            <div className="text-muted">
                              {shortDate(batch.date)} · {batch.createdBy}
                            </div>
                          </div>
                        ),
                        sapIn: weight(batch.sapInLbs),
                        syrup: weight(batch.syrupOutLbs),
                        ratio: batch.syrupOutLbs ? `${(batch.sapInLbs / batch.syrupOutLbs).toFixed(1)} : 1` : "—",
                        brix: batch.brix ? `${batch.brix}°` : "—",
                        duration: formatDuration(batch.boilMinutes),
                        notes: <span className="block truncate">{view.notes[0]?.text ?? "—"}</span>,
                        menu: (
                          <ClosedRowMenu
                            view={view}
                            canEdit={can("batches:editClosed")}
                            onEdit={() => setEditing(batch.batchNumber)}
                          />
                        ),
                      },
                    };
                  })}
                />
              </Card>
            </section>
          ) : null}
        </>
      )}

      {showNew ? <NewBatchModal onClose={() => setShowNew(false)} /> : null}
      {editingView ? (
        <EditBatchModal
          key={editingView.batch.batchNumber}
          view={editingView}
          day={day}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
