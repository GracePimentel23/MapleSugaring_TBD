"use client";

import { useState } from "react";
import { useBatchState } from "@/components/data/BatchStateProvider";
import { useDemo } from "@/components/demo/DemoProvider";
import { CheckIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import DateTimePicker, { formatDateTime, nowMinutes, type DateTime } from "@/components/ui/DateTimePicker";
import PersonPicker from "@/components/ui/PersonPicker";
import { Button, Field, inputClass, Modal } from "@/components/ui/ui";
import { batchStatusLabel } from "@/lib/batchStatus";
import { noteStamp } from "@/lib/time";
import { formatLbsNumber } from "@/lib/units";

interface Receipt {
  lbs: number;
  bucketName: string;
  batchNumber: string;
  batchTotal: number;
  resolvedAlert: string | null;
}

/**
 * Step 1: pick the bucket and batch, confirm the weight, save.
 * Step 2: confirmation of what changed.
 */
export default function LogCollectionModal({
  bucketId,
  onClose,
  onBackToStation,
}: {
  bucketId: number;
  onClose: () => void;
  onBackToStation?: (bucketId: number) => void;
}) {
  const { day } = useDemo();
  const { user, members, grants } = useSession();
  const { weight } = useClubSettings();
  const stations = useStationCards();
  const { logCollection, addNote, resolve } = useStationState();
  const { viewBatch } = useBatchState();

  const openBatches = day.batches
    .map(viewBatch)
    .filter((view) => view.batch.status === "active" || view.batch.status === "waiting");
  const defaultBatch = openBatches.find((view) => view.batch.status === "active") ?? openBatches[0];

  const [selectedBucket, setSelectedBucket] = useState(bucketId);
  const station = stations.find((item) => item.bucketId === selectedBucket) ?? stations[0]!;
  const [batchNumber, setBatchNumber] = useState(defaultBatch?.batch.batchNumber ?? "");
  const [lbs, setLbs] = useState(String(station.currentLbs));
  const [collectedBy, setCollectedBy] = useState(user.name);
  const [when, setWhen] = useState<DateTime>(() => ({ date: day.date, minutes: nowMinutes() }));
  // Anyone whose role may log collections, and whose account is active.
  const collectors = members
    .filter((member) => member.status === "active" && grants[member.role].includes("collections:log"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const parsed = Number.parseFloat(lbs);
  const valid = Number.isFinite(parsed) && parsed > 0 && batchNumber !== "";

  function pickBucket(id: number) {
    setSelectedBucket(id);
    const next = stations.find((item) => item.bucketId === id);
    if (next) setLbs(String(next.currentLbs));
  }

  function save() {
    if (!valid) return;
    const amount = Math.round(parsed * 10) / 10;
    const resolved = station.alerts.find(
      (alert) => alert.kind === "due" || alert.kind === "full" || alert.kind === "sapAge",
    );
    const batch = openBatches.find((view) => view.batch.batchNumber === batchNumber);

    logCollection({
      bucketId: station.bucketId,
      bucketName: station.name,
      lbs: amount,
      batchNumber,
      collectedBy,
      when: formatDateTime(when),
      date: when.date,
      note: note.trim(),
    });
    // Emptying the bucket fixes its fill and sap-age alerts; record who did it.
    station.alerts
      .filter((alert) => alert.kind === "due" || alert.kind === "full" || alert.kind === "sapAge")
      .forEach(resolve);
    if (note.trim()) {
      addNote(station.bucketId, {
        text: note.trim(),
        author: user.name,
        createdAt: noteStamp(day.date),
      });
    }

    setReceipt({
      lbs: amount,
      bucketName: station.name,
      batchNumber,
      batchTotal: Math.round(((batch?.batch.sapInLbs ?? 0) + amount) * 10) / 10,
      resolvedAlert: resolved ? `${resolved.label} alert resolved` : null,
    });
  }

  function logAnother() {
    const next = stations.find(
      (item) => item.bucketId !== station.bucketId && item.currentLbs > 0 && !item.loggedToday,
    );
    if (next) pickBucket(next.bucketId);
    setNote("");
    setWhen({ date: day.date, minutes: nowMinutes() });
    setReceipt(null);
  }

  if (receipt) {
    return (
      <Modal title="Collection logged" onClose={onClose}>
        <div className="pb-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent-light text-accent-mid">
            <CheckIcon size={30} />
          </div>
          <p className="text-body text-muted">
            {weight(receipt.lbs)} from {receipt.bucketName} added to {receipt.batchNumber}.
          </p>
        </div>
        <div className="mb-5 space-y-3 rounded-2xl border border-border p-5">
          {[
            [`${receipt.batchNumber} total`, weight(receipt.batchTotal)],
            [receipt.bucketName, "Marked emptied"],
            ["Alert", receipt.resolvedAlert ?? "None open"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-muted">{label}</span>
              <span className="font-sans text-base font-semibold">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 pb-6">
          <Button onClick={() => (onBackToStation ? onBackToStation(station.bucketId) : onClose())} className="w-full">
            Back To Station
          </Button>
          <Button variant="outline" onClick={logAnother} className="w-full">
            Log Another Bucket
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Log collection"
      eyebrow="Step 1 of 2"
      onClose={onClose}
      footer={
        <div className="w-full">
          <p className="mb-4 text-sm text-muted">
            No signal? It saves on this phone and syncs when you are back online.
          </p>
          <Button onClick={save} disabled={!valid} className="w-full">
            Save Collection
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Bucket">
          <select
            value={station.bucketId}
            onChange={(event) => pickBucket(Number(event.target.value))}
            className={inputClass}
          >
            {stations.map((item) => (
              <option key={item.bucketId} value={item.bucketId}>
                {item.shortName} · {item.treeLabel}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Batch">
          <select value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} className={inputClass}>
            {openBatches.length === 0 ? <option value="">No open batch</option> : null}
            {openBatches.map((view) => (
              <option key={view.batch.id} value={view.batch.batchNumber}>
                {view.batch.batchNumber} · {batchStatusLabel[view.batch.status]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Weight collected (lbs)">
          <input
            type="number"
            inputMode="decimal"
            value={lbs}
            onChange={(event) => setLbs(event.target.value)}
            className={`${inputClass} py-4 font-sans text-3xl font-bold`}
          />
        </Field>
        <Button
          variant="outline"
          className="w-full border-border text-text"
          onClick={() => setLbs(String(station.currentLbs))}
        >
          Use Sensor Reading: {formatLbsNumber(station.currentLbs)} lbs
        </Button>
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
          <Field label="When">
            <DateTimePicker label="When" value={when} onChange={setWhen} today={day.date} />
          </Field>
        </div>
        <Field label="Note (optional)">
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Sap looked clear."
            className={`${inputClass} resize-none`}
          />
        </Field>
      </div>
    </Modal>
  );
}
