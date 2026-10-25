"use client";

import { FullIcon, PlusIcon } from "@/components/icons";
import { useState } from "react";
import { useLive } from "@/components/live/LiveProvider";
import { useSession } from "@/components/session/SessionProvider";
import LogCollectionModal from "@/components/stations/LogCollectionModal";
import { Button, EmptyState, PageHeader } from "@/components/ui/ui";
import { batchStatusLabel } from "@/lib/batchStatus";
import type { LiveDay } from "@/lib/live/day";
import type { Collection, CollectionEntry } from "@/lib/types/schema";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
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
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditRowPopup({
  collection,
  entry,
  onClose,
}: {
  collection: Collection;
  entry: CollectionEntry;
  onClose: () => void;
}) {
  const { send } = useLive();
  const { user } = useSession();
  const [lbs, setLbs] = useState(String(entry.lbs));
  const [collectedBy, setCollectedBy] = useState(entry.collectedBy);
  const parsed = Number.parseFloat(lbs);

  async function save() {
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const entries = collection.entries.map((item) =>
      item.bucketId === entry.bucketId
        ? { bucketId: item.bucketId, lbs: parsed, collectedBy: collectedBy.trim() || item.collectedBy }
        : { bucketId: item.bucketId, lbs: item.lbs, collectedBy: item.collectedBy },
    );
    if (await send("PATCH", `/collections/${collection.id}`, { entries, by: user.name })) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/30"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-sans text-sm font-semibold">Edit {entry.bucketName}</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
            aria-label="Close"
          >
            <CloseIcon size={14} />
          </button>
        </div>
        <div className="space-y-2.5">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Weight (lbs)</label>
            <input
              type="number"
              inputMode="decimal"
              value={lbs}
              onChange={(event) => setLbs(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Collected by</label>
            <input
              value={collectedBy}
              onChange={(event) => setCollectedBy(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border py-2 text-sm font-semibold"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!Number.isFinite(parsed) || parsed < 0}
            className="flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-accent)" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCollectionSheet({
  collection,
  day,
  onClose,
}: {
  collection: Collection;
  day: LiveDay;
  onClose: () => void;
}) {
  const { send } = useLive();
  const { user, members } = useSession();
  const [date, setDate] = useState(collection.date);
  const [batchId, setBatchId] = useState(
    day.batches.find((batch) => batch.batchNumber === collection.batchName)?.id ?? "",
  );
  const [loggedBy, setLoggedBy] = useState(collection.loggedBy);
  const [notes, setNotes] = useState(collection.notes ?? "");
  // bucketId -> weight, for every bucket in the collection (added ones start at their sensor reading)
  const [entries, setEntries] = useState<Record<number, CollectionEntry>>(() =>
    Object.fromEntries(collection.entries.map((entry) => [entry.bucketId, entry])),
  );
  const [saving, setSaving] = useState(false);
  const waitingBatches = day.batches.filter(
    (batch) => batch.status === "waiting" || batch.status === "active",
  );
  const people = [
    ...new Set([collection.loggedBy, user.name, ...members.map((member) => member.name)].filter(Boolean)),
  ];

  function toggle(bucketId: number) {
    setEntries((current) => {
      const next = { ...current };
      if (next[bucketId]) {
        delete next[bucketId];
      } else {
        const bucket = day.buckets.find((item) => item.bucketId === bucketId);
        next[bucketId] = {
          bucketId,
          bucketName: bucket?.name ?? `Bucket #${bucketId}`,
          collectedBy: loggedBy,
          lbs: bucket?.fillLbs ?? 0,
        };
      }
      return next;
    });
  }

  async function save() {
    const list = Object.values(entries);
    if (list.length === 0) return;
    setSaving(true);
    const ok = await send("PATCH", `/collections/${collection.id}`, {
      date,
      batchId: batchId || null,
      loggedBy,
      notes,
      entries: list.map((entry) => ({ bucketId: entry.bucketId, lbs: entry.lbs, collectedBy: entry.collectedBy })),
      by: user.name,
    });
    setSaving(false);
    if (ok) onClose();
  }

  async function remove() {
    if (!window.confirm(`Delete collection ${String(collection.collectionNumber).padStart(2, "0")}? This cannot be undone.`)) {
      return;
    }
    if (await send("DELETE", `/collections/${collection.id}`)) onClose();
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
        <div className="flex shrink-0 justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2">
          <h3 className="font-sans text-base font-semibold">
            Edit Collection {String(collection.collectionNumber).padStart(2, "0")}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Date</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted">Buckets</label>
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
              {day.buckets.map((bucket, index) => {
                const included = Boolean(entries[bucket.bucketId]);
                const wasIn = collection.entries.some((entry) => entry.bucketId === bucket.bucketId);

                return (
                  <div
                    key={bucket.bucketId}
                    className="flex items-center justify-between px-3 py-2.5 text-sm"
                    style={{
                      background: index % 2 === 0 ? "white" : "#F5F5F5",
                      borderTop: index > 0 ? "1px solid var(--color-border)" : "none",
                    }}
                  >
                    <span
                      style={{
                        color: !included && wasIn ? "var(--color-muted)" : "var(--color-text)",
                        textDecoration: !included && wasIn ? "line-through" : "none",
                      }}
                    >
                      {bucket.name}
                      {included ? <span className="ml-2 text-sm text-muted">{entries[bucket.bucketId]!.lbs} lbs</span> : null}
                    </span>
                    {included ? (
                      <button
                        type="button"
                        onClick={() => toggle(bucket.bucketId)}
                        className="rounded-full px-2 py-0.5 text-sm"
                        style={{ color: "#DC2626", background: "rgba(239,68,68,0.1)" }}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggle(bucket.bucketId)}
                        className="rounded-full px-2 py-0.5 text-sm"
                        style={{
                          color: wasIn ? "#16A34A" : "#2B4A1E",
                          background: wasIn ? "rgba(34,197,94,0.1)" : "rgba(43,74,30,0.1)",
                        }}
                      >
                        {wasIn ? "Restore" : "+ Add"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Batch</label>
            <select
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-text outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option value="">— Unassigned —</option>
              {day.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batchNumber} ({batchStatusLabel[batch.status]})
                </option>
              ))}
            </select>
            {waitingBatches.length > 0 ? (
              <p className="mt-1 text-xs text-muted">
                Batches waiting for sap: {waitingBatches.map((batch) => batch.batchNumber).join(", ")}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Logged By</label>
            <select
              value={loggedBy}
              onChange={(event) => setLoggedBy(event.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-text outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              {people.map((person) => (
                <option key={person}>{person}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observations, conditions…"
              className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
          <button
            type="button"
            onClick={remove}
            className="rounded-xl border px-4 py-2.5 font-sans text-sm font-semibold"
            style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
          >
            Delete
          </button>
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
            disabled={saving || Object.keys(entries).length === 0}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-accent)" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Collections({ day }: { day: LiveDay }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editCollectionId, setEditCollectionId] = useState<string | null>(null);
  const [editRowKey, setEditRowKey] = useState<{
    collectionId: string;
    bucketId: number;
  } | null>(null);

  const { can } = useSession();
  // What you may do comes from lib/rbac.config.ts.
  const canAdd = can("collections:log");
  const isAdmin = can("collections:edit");

  // Looked up from the latest data, so an open sheet follows live updates.
  const editCollection = day.collections.find((collection) => collection.id === editCollectionId) ?? null;
  const editRowCollection = day.collections.find((collection) => collection.id === editRowKey?.collectionId) ?? null;
  const editRowEntry = editRowCollection?.entries.find((entry) => entry.bucketId === editRowKey?.bucketId) ?? null;

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <PageHeader
        title="Collections"
        subtitle={`${day.collections.length} collection${day.collections.length === 1 ? "" : "s"} · most recent first`}
        actions={
          canAdd ? (
            <Button onClick={() => setShowAdd(true)}>
              <PlusIcon size={16} />
              Log Collection
            </Button>
          ) : null
        }
      />

      {day.collections.length === 0 ? (
        <EmptyState
          icon={<FullIcon size={26} />}
          title="No collections logged yet"
          description="Nothing has been emptied into storage yet. Logged collections show here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {day.collections.map((collection) => {
            const isOpen = expanded === collection.id;
            const number = String(collection.collectionNumber).padStart(2, "0");

            return (
              <div
                key={collection.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <div className="flex w-full items-center justify-between px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : collection.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-sans text-xs font-bold text-white"
                      style={{ background: "var(--color-accent)" }}
                    >
                      #{number}
                    </div>
                    <div className="min-w-0">
                      <div className="font-sans text-sm font-semibold">{formatDate(collection.date)}</div>
                      <div className="text-sm text-muted">
                        {collection.entries.length} bucket
                        {collection.entries.length === 1 ? "" : "s"} · {collection.batchName}
                      </div>
                    </div>
                  </button>

                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="font-sans text-sm font-bold">{collection.totalLbs} lbs</span>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => setEditCollectionId(collection.id)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-gray-100"
                        aria-label={`Edit collection ${number}`}
                      >
                        <EditIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : collection.id)}
                      className="text-muted"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      <ChevronIcon open={isOpen} />
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="border-t" style={{ borderColor: "var(--color-border)" }}>
                    <div
                      className="grid px-4 py-2 text-xs font-medium text-muted"
                      style={{ gridTemplateColumns: "1fr 1fr 80px 32px" }}
                    >
                      <span>Bucket</span>
                      <span>Collected By</span>
                      <span>Weight</span>
                      <span />
                    </div>
                    {collection.entries.map((entry, index) => (
                      <div
                        key={entry.bucketId}
                        className="grid items-center px-4 py-2.5 text-sm"
                        style={{
                          gridTemplateColumns: "1fr 1fr 80px 32px",
                          background: index % 2 === 0 ? "white" : "#F5F5F5",
                          borderTop: "1px solid var(--color-border)",
                        }}
                      >
                        <span className="font-medium">{entry.bucketName}</span>
                        <span className="text-muted">{entry.collectedBy}</span>
                        <span className="text-muted">{entry.lbs} lbs</span>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEditRowKey({
                                collectionId: collection.id,
                                bucketId: entry.bucketId,
                              })
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-gray-200"
                            aria-label={`Edit ${entry.bucketName} entry`}
                          >
                            <EditIcon />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                    {collection.notes ? (
                      <div
                        className="border-t px-4 py-3 text-sm text-muted"
                        style={{ borderColor: "var(--color-border)", background: "#F5F5F5" }}
                      >
                        <span className="font-semibold text-text">Note:</span> {collection.notes}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {showAdd ? (
        <LogCollectionModal bucketId={day.buckets[0]?.bucketId ?? 1} onClose={() => setShowAdd(false)} />
      ) : null}
      {editCollection ? (
        <EditCollectionSheet collection={editCollection} day={day} onClose={() => setEditCollectionId(null)} />
      ) : null}
      {editRowCollection && editRowEntry ? (
        <EditRowPopup collection={editRowCollection} entry={editRowEntry} onClose={() => setEditRowKey(null)} />
      ) : null}
    </div>
  );
}
