"use client";

import { useState } from "react";
import { useBatchState } from "@/components/data/BatchStateProvider";
import { useLive } from "@/components/live/LiveProvider";
import { CheckIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationCards, useStationState, type CollectionEntry } from "@/components/stations/StationStateProvider";
import PersonPicker from "@/components/ui/PersonPicker";
import Select from "@/components/ui/Select";
import { Button, Field, inputClass, Modal, Steps } from "@/components/ui/ui";
import { batchStatusLabel, NEW_BATCH, newBatchOption } from "@/lib/batchStatus";
import { monthDay } from "@/lib/time";
import type { Collection, StationView } from "@/lib/types/schema";

/**
 * Opened from an alert's Start Collection: the bucket being emptied, its weight before emptying,
 * and the collection the sap goes into (null starts a new one).
 */
export interface GuidedCollection {
  bucketId: number;
  lbs: number;
  into: Collection | null;
}

/** A bucket picked to empty, with the weight to log (starts at its last reading, editable). */
interface Picked {
  bucketId: number;
  lbs: string;
}

/** Buckets you can log from: ones whose sensor is working (no signal or a sensor fault are left out). */
function canLogFrom(station: StationView): boolean {
  return station.status !== "offline" && !station.alerts.some((alert) => alert.kind === "sensor");
}

/**
 * Log a collection: pick one or more buckets, check the weights (filled in from each bucket's last
 * reading), save. "Log Another Bucket" afterwards adds to the same collection instead of starting a
 * new one. Opened from a station it starts with that bucket; from Collections, with none.
 */
export default function LogCollectionModal({
  bucketId,
  onClose,
  guided,
}: {
  bucketId: number | null;
  onClose: () => void;
  guided?: GuidedCollection;
}) {
  const { day } = useLive();
  const { user, members, grants, can } = useSession();
  const { weight } = useClubSettings();
  const stations = useStationCards();
  const { logCollection, addToCollection, finishEmptying } = useStationState();
  const { viewBatch, startBatch } = useBatchState();

  const eligible = stations.filter(canLogFrom);
  const hiddenCount = stations.length - eligible.length;
  const openBatches = day.batches
    .map(viewBatch)
    .filter((view) => view.batch.status === "active" || view.batch.status === "waiting");
  const defaultBatch = openBatches.find((view) => view.batch.status === "active") ?? openBatches[0];
  const startWith = eligible.find((station) => station.bucketId === bucketId);

  const [picked, setPicked] = useState<Picked[]>(
    guided
      ? [{ bucketId: guided.bucketId, lbs: String(guided.lbs) }]
      : startWith
        ? [{ bucketId: startWith.bucketId, lbs: String(startWith.currentLbs) }]
        : [],
  );
  // "" means no batch yet: the collection is picked when a batch is started.
  const [batchId, setBatchId] = useState(defaultBatch?.batch.id ?? "");
  const [collectedBy, setCollectedBy] = useState(user.name);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  // After the first save: the collection, and every bucket in it so far.
  // Adding to an existing collection (from Start Collection) starts out as if it had been saved.
  const [saved, setSaved] = useState<{ id: string; entries: CollectionEntry[] } | null>(
    guided?.into
      ? {
          id: guided.into.id,
          entries: guided.into.entries.map((entry) => ({
            bucketId: entry.bucketId,
            lbs: entry.lbs,
            collectedBy: entry.collectedBy,
          })),
        }
      : null,
  );
  const [showReceipt, setShowReceipt] = useState(false);

  // Anyone whose role may log collections, and whose account is active.
  const collectors = members
    .filter((member) => member.status === "active" && (grants[member.role]?.includes("collections:log") ?? true))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Adding to a collection already logged is an edit on the worker, which Managers and up may do.
  const canAddMore = can("collections:edit");
  // Starting a batch is a Manager's job on the worker too.
  const canStartBatch = can("batches:manage");
  const savedIds = new Set(saved?.entries.map((entry) => entry.bucketId) ?? []);
  const choices = eligible.filter(
    (station) => !savedIds.has(station.bucketId) && !picked.some((item) => item.bucketId === station.bucketId),
  );
  const entries: CollectionEntry[] = picked.map((item) => ({
    bucketId: item.bucketId,
    lbs: Math.round(Number.parseFloat(item.lbs) * 10) / 10,
    collectedBy: collectedBy.trim() || user.name,
  }));
  const valid = entries.length > 0 && entries.every((entry) => Number.isFinite(entry.lbs) && entry.lbs > 0) && !saving;
  const stationFor = (id: number) => stations.find((station) => station.bucketId === id);

  function addBucket(id: number) {
    const station = stationFor(id);
    if (station) setPicked((current) => [...current, { bucketId: id, lbs: String(station.currentLbs) }]);
  }

  async function save() {
    if (!valid) return;
    setSaving(true);
    if (saved) {
      const ok = await addToCollection(saved.id, [...saved.entries, ...entries]);
      setSaving(false);
      if (!ok) return;
      setSaved({ id: saved.id, entries: [...saved.entries, ...entries] });
    } else {
      // "+ Start a new batch": create it now, so nothing is left behind if the form is closed.
      let batch = batchId;
      if (batchId === NEW_BATCH) {
        const created = await startBatch();
        if (!created) {
          setSaving(false);
          return;
        }
        batch = created;
        setBatchId(created);
      }
      const id = await logCollection({
        entries,
        batchId: batch,
        loggedBy: collectedBy.trim() || user.name,
        // Always today: a collection is logged when it happens.
        date: day.date,
        note: note.trim(),
      });
      setSaving(false);
      if (!id) return;
      setSaved({ id, entries });
    }
    if (guided) {
      const amount = entries.find((entry) => entry.bucketId === guided.bucketId)?.lbs ?? guided.lbs;
      const target = guided.into
        ? `Collection #${String(guided.into.collectionNumber).padStart(2, "0")}`
        : "a new collection";
      finishEmptying(guided.bucketId, `Emptied, ${amount} lbs into ${target}`);
    }
    setPicked([]);
    setShowReceipt(true);
  }

  if (stations.length === 0) {
    return (
      <Modal title="Log Collection" onClose={onClose}>
        <p className="pb-6 text-muted">There are no stations yet. Add one on the Stations page first.</p>
      </Modal>
    );
  }

  if (showReceipt && saved) {
    const total = saved.entries.reduce((sum, entry) => sum + entry.lbs, 0);
    const batch = openBatches.find((view) => view.batch.id === batchId);
    return (
      <Modal
        title="Collection Logged"
        width="lg"
        onClose={onClose}
        footer={
          <>
            {choices.length > 0 && canAddMore ? (
              <Button variant="outline" onClick={() => setShowReceipt(false)}>
                Log Another Bucket
              </Button>
            ) : null}
            <Button onClick={onClose}>Done</Button>
          </>
        }
      >
        <div className="pb-2 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-light text-accent-mid">
            <CheckIcon size={30} />
          </div>
          <p className="text-body text-muted">
            {weight(Math.round(total * 10) / 10)} from {saved.entries.length} bucket
            {saved.entries.length === 1 ? "" : "s"}
            {batch ? `, added to ${batch.batch.batchNumber}` : ", not in a batch yet"}.
          </p>
        </div>
        <ul className="my-5 divide-y divide-border rounded-2xl border border-border px-5">
          {saved.entries.map((entry) => (
            <li key={entry.bucketId} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="block font-sans text-body font-semibold">{stationFor(entry.bucketId)?.name}</span>
                <span className="block text-sm text-muted">Marked emptied</span>
              </span>
              <span className="font-sans text-base font-semibold">{weight(entry.lbs)}</span>
            </li>
          ))}
        </ul>
        {choices.length > 0 && canAddMore ? (
          <p className="pb-2 text-sm text-muted">Log Another Bucket adds it to this same collection.</p>
        ) : null}
      </Modal>
    );
  }

  const bucketName = guided ? stationFor(guided.bucketId)?.name : null;
  return (
    <Modal
      title={saved ? "Add to Collection" : "Log Collection"}
      eyebrow={
        guided
          ? `Emptying ${bucketName ?? "the bucket"}`
          : saved
            ? `${saved.entries.length} bucket${saved.entries.length === 1 ? "" : "s"} logged so far`
            : undefined
      }
      width="lg"
      onClose={onClose}
      footer={
        <div className="w-full">
          <Button onClick={save} disabled={!valid} className="w-full">
            {saving ? "Saving…" : guided ? "Finished Collection" : saved ? "Add to Collection" : "Save Collection"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {guided ? (
          <div className="rounded-xl bg-bg px-4 py-3">
            <Steps
              current={1}
              items={[
                "Collection started: weight alerts are paused.",
                `Empty ${bucketName ?? "the bucket"} into the collection barrel.`,
                <>
                  Put the bucket back and press <span className="font-semibold">Finished Collection</span>.
                </>,
              ]}
            />
          </div>
        ) : null}

        {/* Emptying one bucket from its alert: that is the only bucket here, so no picker. A plain
            Log Collection can take several buckets, because one trip often empties a few into the
            same barrel, and they belong in one collection. */}
        {guided ? null : (
          <Field
            label={picked.length ? "Buckets" : "Bucket"}
            required
            hint={hiddenCount > 0 ? "Buckets with no signal or a sensor fault are not listed." : undefined}
          >
            <Select
              label={picked.length ? "Add another bucket" : "Choose bucket"}
              value=""
              onChange={(value) => value && addBucket(Number(value))}
              disabled={choices.length === 0}
              icon={picked.length ? <PlusIcon size={16} /> : undefined}
              placeholder={
                choices.length === 0 ? "No other buckets to add" : picked.length ? "Add another bucket" : "Choose bucket"
              }
              options={choices.map((station) => ({
                value: String(station.bucketId),
                label: station.name,
                detail: `${station.location} · last reading ${weight(station.currentLbs, true, true)}`,
              }))}
            />
          </Field>
        )}

        <div>
          <span className="mb-1.5 block text-sm text-muted">Weight collected</span>
          {picked.length === 0 ? (
            // Greyed out until a bucket is chosen: its last reading fills this in.
            <div className="rounded-xl border border-dashed border-border bg-bg px-4 py-4 text-sm text-muted">
              Choose a bucket and its last reading fills in here.
            </div>
          ) : (
            <ul className="space-y-2">
              {picked.map((item) => {
                const station = stationFor(item.bucketId);
                return (
                  <li key={item.bucketId} className="flex items-center gap-3 rounded-xl bg-bg px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-sans text-body font-semibold">{station?.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {guided?.bucketId === item.bucketId
                          ? "Weight before emptying"
                          : `Last reading ${station ? weight(station.currentLbs, true, true) : "—"}`}
                      </span>
                    </span>
                    <label className="flex w-32 items-baseline gap-1 rounded-xl border border-border bg-white px-3 py-1.5 focus-within:border-accent-mid">
                      <input
                        type="number"
                        inputMode="decimal"
                        aria-label={`Weight from ${station?.name}`}
                        value={item.lbs}
                        onChange={(event) =>
                          setPicked((current) =>
                            current.map((entry) =>
                              entry.bucketId === item.bucketId ? { ...entry, lbs: event.target.value } : entry,
                            ),
                          )
                        }
                        className="w-full min-w-0 bg-transparent text-right font-sans text-lg font-semibold outline-none"
                      />
                      <span className="text-sm text-muted">lbs</span>
                    </label>
                    {guided?.bucketId === item.bucketId ? null : (
                      <button
                        type="button"
                        aria-label={`Remove ${station?.name}`}
                        onClick={() =>
                          setPicked((current) => current.filter((entry) => entry.bucketId !== item.bucketId))
                        }
                        className="rounded-lg p-1 text-muted hover:bg-white hover:text-text"
                      >
                        <CloseIcon size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {saved ? null : (
          <Field label="Batch">
            {openBatches.length === 0 && !canStartBatch ? (
              <div className="rounded-xl border border-border bg-bg px-4 py-3 text-body text-muted">
                No open batches
              </div>
            ) : (
              <Select
                label="Batch"
                value={batchId}
                onChange={setBatchId}
                options={[
                  ...openBatches.map((view) => ({
                    value: view.batch.id,
                    label: view.batch.batchNumber,
                    detail: batchStatusLabel[view.batch.status],
                  })),
                  { value: "", label: "Not in a batch yet", detail: "Pick it when a batch is started" },
                  ...(canStartBatch ? [newBatchOption] : []),
                ]}
              />
            )}
          </Field>
        )}

        <Field label="Collected by" hint={`Logged for today, ${monthDay(day.date)}.`}>
          <PersonPicker
            label="Collected by"
            people={collectors}
            value={collectedBy}
            onChange={setCollectedBy}
            currentUserId={user.id}
          />
        </Field>
        {saved ? null : (
          <Field label="Note (optional)">
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Sap looked clear."
              className={`${inputClass} resize-none`}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
