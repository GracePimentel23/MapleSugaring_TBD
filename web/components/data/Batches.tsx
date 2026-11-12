"use client";

import { useRef, useState } from "react";
import { useBatchState, type BatchView } from "@/components/data/BatchStateProvider";
import { DropIcon, MoreIcon, PencilIcon, PlusIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { NotesList } from "@/components/stations/StationForms";
import Popover from "@/components/ui/Popover";
import {
  Button,
  Card,
  cx,
  DataTable,
  EmptyState,
  Field,
  InfoBox,
  inputClass,
  Modal,
  PageHeader,
  StatCard,
} from "@/components/ui/ui";
import { batchStatusLabel } from "@/lib/batchStatus";
import type { LiveDay } from "@/lib/live/day";
import { monthDay, noteStamp, shortDate } from "@/lib/time";
import { sapSeasonOf } from "@/lib/live/day";
import type { Batch, BatchStatus, Collection } from "@/lib/types/schema";

const stages = ["Collecting", "Waiting", "Boiling", "Completed"] as const;

/** Where each status sits on the track: collecting, then waiting in storage, then boiling, then done. */
const stageIndex: Record<BatchStatus, number> = {
  active: 0,
  waiting: 1,
  processing: 2,
  completed: 3,
};

const stageOrder: BatchStatus[] = ["active", "waiting", "processing", "completed"];

/** The button that moves a batch on to its next stage. */
const nextStep: Partial<Record<BatchStatus, { to: BatchStatus; label: string }>> = {
  active: { to: "waiting", label: "Done Collecting" },
  waiting: { to: "processing", label: "Start Boiling" },
  processing: { to: "completed", label: "Finish Batch" },
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
              // Stages already done are pale green, the current one is strong, the rest are still to come.
              background: index > current ? "var(--color-progress-track)" : index === current ? "#4F8F45" : "#B9D3AE",
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

/** "#05" */
function collectionLabel(collection: Collection): string {
  return `#${String(collection.collectionNumber).padStart(2, "0")}`;
}

/**
 * Pick collections for a batch: each row is one logged collection with its date, buckets and weight.
 * `choices` are the ones not in another batch (plus this batch's own when editing).
 */
function CollectionPicker({
  choices,
  selected,
  onChange,
}: {
  choices: Collection[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { weight } = useClubSettings();
  if (choices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-bg px-4 py-4 text-sm text-muted">
        No collections waiting for a batch. Log a collection first.
      </div>
    );
  }
  return (
    <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-2xl border border-border">
      {choices.map((collection) => {
        const on = selected.includes(collection.id);
        return (
          <li key={collection.id}>
            <label className={cx("flex cursor-pointer items-center gap-3 px-4 py-3", on && "bg-accent-light")}>
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  onChange(on ? selected.filter((id) => id !== collection.id) : [...selected, collection.id])
                }
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-sans text-body font-semibold">
                  Collection {collectionLabel(collection)} · {monthDay(collection.date)}
                </span>
                <span className="block truncate text-sm text-muted">
                  {collection.entries.map((entry) => entry.bucketName).join(", ")}
                </span>
              </span>
              <span className="font-sans text-body font-semibold">{weight(collection.totalLbs)}</span>
            </label>
          </li>
        );
      })}
    </ul>
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

function OpenBatchCard({
  view,
  collections,
  onEdit,
  onAdvance,
}: {
  view: BatchView;
  collections: Collection[];
  onEdit: (() => void) | null;
  onAdvance: (() => void) | null;
}) {
  const { weight, weightUnit } = useClubSettings();
  const { batch } = view;
  const mine = collections.filter((collection) => view.collectionIds.includes(collection.id));
  const next = nextStep[batch.status];

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
            Started {monthDay(batch.date)} · {batch.createdBy}
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

      <div className="mb-5 grid grid-cols-2 gap-3 md:max-w-md">
        <InfoBox label="Sap in" value={weight(batch.sapInLbs, false)} unit={weightUnit} large />
        <InfoBox label="Collections" value={mine.length} large />
      </div>
      {mine.length ? (
        <p className="mb-5 text-sm text-muted">
          {mine.map((collection) => `${collectionLabel(collection)} (${monthDay(collection.date)})`).join(" · ")}
        </p>
      ) : null}

      <StageTrack status={batch.status} />
      {next && onAdvance ? (
        <Button className="mt-5" onClick={onAdvance}>
          {next.label}
        </Button>
      ) : null}
      <BatchNotes view={view} />
    </Card>
  );
}

/** Completing a batch: the only time syrup out, Brix and boil time are entered. */
function FinishFields({
  syrupOut,
  setSyrupOut,
  brix,
  setBrix,
  hours,
  setHours,
}: {
  syrupOut: string;
  setSyrupOut: (value: string) => void;
  brix: string;
  setBrix: (value: string) => void;
  hours: string;
  setHours: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Syrup out (lbs)">
        <input
          type="number"
          inputMode="decimal"
          value={syrupOut}
          onChange={(event) => setSyrupOut(event.target.value)}
          placeholder="0.0"
          className={inputClass}
        />
      </Field>
      <Field label="Brix (°)" hint="Grade A is 66 to 68°.">
        <input
          type="number"
          inputMode="decimal"
          value={brix}
          onChange={(event) => setBrix(event.target.value)}
          placeholder="66.5"
          className={inputClass}
        />
      </Field>
      <Field label="Boil time (hours)">
        <input
          type="number"
          inputMode="decimal"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          placeholder="5.5"
          className={inputClass}
        />
      </Field>
    </div>
  );
}

/** Numbers from the finish fields, or null where one is missing or not a number. */
function finishValues(syrupOut: string, brix: string, hours: string) {
  const out = Number.parseFloat(syrupOut);
  const grade = Number.parseFloat(brix);
  const time = Number.parseFloat(hours);
  return {
    syrupOutLbs: Number.isFinite(out) && out > 0 ? out : null,
    brix: Number.isFinite(grade) && grade > 0 ? grade : null,
    boilMinutes: Number.isFinite(time) && time > 0 ? Math.round(time * 60) : undefined,
  };
}

function FinishBatchModal({ view, onClose }: { view: BatchView; onClose: () => void }) {
  const { saveBatch } = useBatchState();
  const { batch } = view;
  const [syrupOut, setSyrupOut] = useState("");
  const [brix, setBrix] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const values = finishValues(syrupOut, brix, hours);

  async function save() {
    if (values.syrupOutLbs === null || values.brix === null) return;
    setSaving(true);
    const ok = await saveBatch(
      batch,
      { status: "completed", syrupOutLbs: values.syrupOutLbs, brix: values.brix, boilMinutes: values.boilMinutes },
      note,
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title={`Finish ${batch.batchNumber}`}
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || values.syrupOutLbs === null || values.brix === null}>
            {saving ? "Saving…" : "Complete Batch"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="text-body text-muted">
          Enter what came off the evaporator. Once completed, the batch is locked; only the Owner / IT can change it.
        </p>
        <FinishFields
          syrupOut={syrupOut}
          setSyrupOut={setSyrupOut}
          brix={brix}
          setBrix={setBrix}
          hours={hours}
          setHours={setHours}
        />
        <Field label="Note (optional)">
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Color, taste, anything worth remembering…"
            className={`${inputClass} resize-none`}
          />
        </Field>
      </div>
    </Modal>
  );
}

function ClosedRowMenu({ view, canEdit, onEdit }: { view: BatchView; canEdit: boolean; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  return (
    <div>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`More for ${view.batch.batchNumber}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg p-1.5 hover:bg-bg"
      >
        <MoreIcon size={20} />
      </button>
      {/* Drawn above the page, so the table's sideways scroll cannot cut it off. */}
      <Popover
        anchor={anchor}
        panelRef={panel}
        open={open}
        onClose={() => setOpen(false)}
        estimatedHeight={100}
        className="w-56 p-1.5"
      >
        <div role="menu">
          <button
            type="button"
            role="menuitem"
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
            role="menuitem"
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
      </Popover>
      {showNotes ? (
        <Modal title={`${view.batch.batchNumber} Notes`} onClose={() => setShowNotes(false)}>
          <div className="pb-6">
            {view.notes.length ? <NotesList notes={view.notes} /> : <p className="text-muted">No notes yet.</p>}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * Edit a batch: its stage, which collections are in it, and a note. The start date never changes.
 * Choosing Completed asks for syrup out, Brix and boil time.
 */
function EditBatchModal({ view, day, onClose }: { view: BatchView; day: LiveDay; onClose: () => void }) {
  const { saveBatch } = useBatchState();
  const { user } = useSession();
  const { weight, weightUnit } = useClubSettings();
  const { batch } = view;
  const [status, setStatus] = useState<BatchStatus>(batch.status);
  const [collectionIds, setCollectionIds] = useState<string[]>(view.collectionIds);
  const [syrupOut, setSyrupOut] = useState(batch.syrupOutLbs ? String(batch.syrupOutLbs) : "");
  const [brix, setBrix] = useState(batch.brix ? String(batch.brix) : "");
  const [hours, setHours] = useState(batch.boilMinutes ? String(Math.round((batch.boilMinutes / 60) * 10) / 10) : "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  // Collections not in any batch, plus this batch's own.
  const choices = day.collections
    .filter((collection) => collection.batchName === "Unassigned" || view.collectionIds.includes(collection.id))
    .sort((a, b) => a.collectionNumber - b.collectionNumber);
  const sapIn = choices
    .filter((collection) => collectionIds.includes(collection.id))
    .reduce((sum, collection) => sum + collection.totalLbs, 0);
  const finishing = status === "completed";
  const values = finishValues(syrupOut, brix, hours);
  const valid = collectionIds.length > 0 && (!finishing || (values.syrupOutLbs !== null && values.brix !== null));

  async function save() {
    if (!valid) return;
    setSaving(true);
    const ok = await saveBatch(
      batch,
      {
        status,
        collectionIds,
        ...(finishing ? { syrupOutLbs: values.syrupOutLbs!, brix: values.brix!, boilMinutes: values.boilMinutes } : {}),
      },
      note,
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title={`Edit ${batch.batchNumber}`}
      eyebrow={`Started ${monthDay(batch.date)} by ${batch.createdBy || "someone"}`}
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !valid}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {batch.status === "completed" ? (
          <p className="rounded-xl border border-attention-border bg-attention-bg px-4 py-2.5 text-sm">
            This batch is completed. Saving overrides the lock and is written to the audit log.
          </p>
        ) : null}

        <div>
          <span className="mb-1.5 block text-sm text-muted">Stage</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Stage">
            {stageOrder.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={status === option}
                onClick={() => setStatus(option)}
                className={cx(
                  "rounded-xl border px-3 py-2.5 font-sans text-body font-semibold transition-colors",
                  status === option
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-white hover:border-accent/40",
                )}
              >
                {batchStatusLabel[option]}
              </button>
            ))}
          </div>
        </div>

        {finishing ? (
          <FinishFields
            syrupOut={syrupOut}
            setSyrupOut={setSyrupOut}
            brix={brix}
            setBrix={setBrix}
            hours={hours}
            setHours={setHours}
          />
        ) : null}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted">Collections in this batch</span>
            <span className="text-sm text-muted">
              Sap in <span className="font-sans font-semibold text-text">{weight(sapIn, false)}</span> {weightUnit}
            </span>
          </div>
          <CollectionPicker choices={choices} selected={collectionIds} onChange={setCollectionIds} />
          {collectionIds.length === 0 ? (
            <p className="mt-1 text-sm text-status-problem">A batch needs at least one collection.</p>
          ) : null}
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

/** Start a batch from collections already logged. It starts Collecting, dated today. */
function NewBatchModal({ day, onClose }: { day: LiveDay; onClose: () => void }) {
  const { createBatch } = useBatchState();
  const { weight, weightUnit } = useClubSettings();
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const choices = day.collections
    .filter((collection) => collection.batchName === "Unassigned")
    .sort((a, b) => a.collectionNumber - b.collectionNumber);
  const sapIn = choices
    .filter((collection) => collectionIds.includes(collection.id))
    .reduce((sum, collection) => sum + collection.totalLbs, 0);

  async function save() {
    if (collectionIds.length === 0) return;
    setSaving(true);
    const ok = await createBatch({ collectionIds, notes: notes.trim() });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title="New Batch"
      eyebrow={`Starts today, ${monthDay(day.date)}`}
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || collectionIds.length === 0}>
            {saving ? "Starting…" : "Start Batch"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-1.5 block text-sm text-muted">Choose the collections going into this batch</span>
          <CollectionPicker choices={choices} selected={collectionIds} onChange={setCollectionIds} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="Sap in" value={weight(sapIn, false)} unit={weightUnit} />
          <InfoBox label="Collections" value={collectionIds.length} />
        </div>
        <Field label="Notes (optional)">
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={`${inputClass} resize-none`}
          />
        </Field>
      </div>
    </Modal>
  );
}

export default function Batches({ day }: { day: LiveDay }) {
  const { viewBatch } = useBatchState();
  const { can } = useSession();
  const { weight } = useClubSettings();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<string | null>(null);
  const { saveBatch } = useBatchState();

  // This season's batches; older seasons are on the Overview and Analysis pages.
  const views = day.batches.filter((batch) => sapSeasonOf(batch.date) === sapSeasonOf(day.date)).map(viewBatch);
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
  const finishingView = views.find((view) => view.batch.batchNumber === finishing) ?? null;

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
                {open.map((view) => {
                  const next = nextStep[view.batch.status];
                  return (
                    <OpenBatchCard
                      key={view.batch.id}
                      view={view}
                      collections={day.collections}
                      onEdit={editHandler(view.batch)}
                      onAdvance={
                        next && can("batches:manage")
                          ? () =>
                              next.to === "completed"
                                ? setFinishing(view.batch.batchNumber)
                                : void saveBatch(view.batch, { status: next.to }, "")
                          : null
                      }
                    />
                  );
                })}
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

      {showNew ? <NewBatchModal day={day} onClose={() => setShowNew(false)} /> : null}
      {finishingView ? <FinishBatchModal view={finishingView} onClose={() => setFinishing(null)} /> : null}
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
