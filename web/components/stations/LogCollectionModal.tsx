"use client";

import { useState } from "react";
import { useBatchState } from "@/components/data/BatchStateProvider";
import { useLive } from "@/components/live/LiveProvider";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationCards, useStationState, type CollectionEntry } from "@/components/stations/StationStateProvider";
import DateTimePicker, { nowMinutes, type DateTime } from "@/components/ui/DateTimePicker";
import PersonPicker from "@/components/ui/PersonPicker";
import { Button, Field, inputClass, Modal } from "@/components/ui/ui";
import { batchStatusLabel } from "@/lib/batchStatus";
import type { StationView } from "@/lib/types/schema";

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
export default function LogCollectionModal({ bucketId, onClose }: { bucketId: number | null; onClose: () => void }) {
  const { day } = useLive();
  const { user, members, grants } = useSession();
  const { weight } = useClubSettings();
  const stations = useStationCards();
  const { logCollection, addToCollection } = useStationState();
  const { viewBatch } = useBatchState();

  const eligible = stations.filter(canLogFrom);
  const hiddenCount = stations.length - eligible.length;
  const openBatches = day.batches
    .map(viewBatch)
    .filter((view) => view.batch.status === "active" || view.batch.status === "waiting");
  const defaultBatch = openBatches.find((view) => view.batch.status === "active") ?? openBatches[0];
  const startWith = eligible.find((station) => station.bucketId === bucketId);

  const [picked, setPicked] = useState<Picked[]>(
    startWith ? [{ bucketId: startWith.bucketId, lbs: String(startWith.currentLbs) }] : [],
  );
  // "" means no batch yet: the collection is picked when a batch is started.
  const [batchId, setBatchId] = useState(defaultBatch?.batch.id ?? "");
  const [collectedBy, setCollectedBy] = useState(user.name);
  const [when, setWhen] = useState<DateTime>(() => ({ date: day.date, minutes: nowMinutes() }));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  // After the first save: the collection, and every bucket in it so far.
  const [saved, setSaved] = useState<{ id: string; entries: CollectionEntry[] } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Anyone whose role may log collections, and whose account is active.
  const collectors = members
    .filter((member) => member.status === "active" && (grants[member.role]?.includes("collections:log") ?? true))
    .sort((a, b) => a.name.localeCompare(b.name));

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
      const id = await logCollection({
        entries,
        batchId,
        loggedBy: collectedBy.trim() || user.name,
        date: when.date,
        note: note.trim(),
      });
      setSaving(false);
      if (!id) return;
      setSaved({ id, entries });
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
            {choices.length > 0 ? (
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
        {choices.length > 0 ? (
          <p className="pb-2 text-sm text-muted">Log Another Bucket adds it to this same collection.</p>
        ) : null}
      </Modal>
    );
  }

  return (
    <Modal
      title={saved ? "Add to Collection" : "Log Collection"}
      eyebrow={
        saved ? `${saved.entries.length} bucket${saved.entries.length === 1 ? "" : "s"} logged so far` : undefined
      }
      width="lg"
      onClose={onClose}
      footer={
        <div className="w-full">
          <Button onClick={save} disabled={!valid} className="w-full">
            {saving ? "Saving…" : saved ? "Add to Collection" : "Save Collection"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field
          label={picked.length ? "Buckets" : "Bucket"}
          hint={hiddenCount > 0 ? "Buckets with no signal or a sensor fault are not listed." : undefined}
        >
          <select
            value=""
            onChange={(event) => event.target.value && addBucket(Number(event.target.value))}
            disabled={choices.length === 0}
            className={inputClass}
          >
            <option value="" disabled>
              {choices.length === 0
                ? "No other buckets to add"
                : picked.length
                  ? "Add another bucket…"
                  : "Choose the bucket you're emptying…"}
            </option>
            {choices.map((station) => (
              <option key={station.bucketId} value={station.bucketId}>
                {station.name} · {station.location}
              </option>
            ))}
          </select>
        </Field>

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
                  <li key={item.bucketId} className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-sans text-body font-semibold">{station?.name}</span>
                      <span className="block truncate text-sm text-muted">
                        Last reading {station ? weight(station.currentLbs, true, true) : "—"}
                      </span>
                    </span>
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
                      className="w-24 rounded-xl border border-border bg-white px-3 py-2 text-right font-sans text-lg font-bold outline-none focus:border-accent-mid"
                    />
                    <span className="text-sm text-muted">lbs</span>
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {saved ? null : (
          <Field label="Batch">
            {openBatches.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg px-4 py-3 text-body text-muted">
                No open batches
              </div>
            ) : (
              <select value={batchId} onChange={(event) => setBatchId(event.target.value)} className={inputClass}>
                {openBatches.map((view) => (
                  <option key={view.batch.id} value={view.batch.id}>
                    {view.batch.batchNumber} · {batchStatusLabel[view.batch.status]}
                  </option>
                ))}
                <option value="">Not in a batch yet</option>
              </select>
            )}
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Collected by">
            <PersonPicker
              label="Collected by"
              people={collectors}
              value={collectedBy}
              onChange={setCollectedBy}
              currentUserId={user.id}
            />
          </Field>
          {saved ? null : (
            <Field label="When">
              <DateTimePicker label="When" value={when} onChange={setWhen} today={day.date} />
            </Field>
          )}
        </div>
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
