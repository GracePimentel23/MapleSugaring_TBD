"use client";

import { FullIcon, PlusIcon } from "@/components/icons";
import { useState } from "react";
import { useLive } from "@/components/live/LiveProvider";
import { useSession } from "@/components/session/SessionProvider";
import LogCollectionModal from "@/components/stations/LogCollectionModal";
import { useStationCards } from "@/components/stations/StationStateProvider";
import PersonPicker from "@/components/ui/PersonPicker";
import { Button, ConfirmModal, EmptyState, Field, inputClass, Modal, PageHeader } from "@/components/ui/ui";
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

/** Who may be named as collecting: active accounts whose role may log collections. */
function useCollectors() {
  const { members, grants } = useSession();
  return members
    .filter((member) => member.status === "active" && (grants[member.role]?.includes("collections:log") ?? true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The small pop-up for one bucket in a collection: its weight and who collected it. Used to edit a
 * bucket already in the collection (Save) and to add one (Add).
 */
function BucketEntryPopup({
  title,
  initialLbs,
  initialCollectedBy,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initialLbs: number;
  initialCollectedBy: string;
  submitLabel: string;
  onSubmit: (lbs: number, collectedBy: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { user } = useSession();
  const collectors = useCollectors();
  const [lbs, setLbs] = useState(String(initialLbs));
  const [collectedBy, setCollectedBy] = useState(initialCollectedBy || user.name);
  const [saving, setSaving] = useState(false);
  const parsed = Number.parseFloat(lbs);
  const valid = Number.isFinite(parsed) && parsed > 0 && !saving;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    const ok = await onSubmit(Math.round(parsed * 10) / 10, collectedBy.trim() || user.name);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" className="border-border text-text" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {saving ? "Saving…" : submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Weight (lbs)">
          <input
            type="number"
            inputMode="decimal"
            value={lbs}
            onChange={(event) => setLbs(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Collected by">
          <PersonPicker
            label="Collected by"
            people={collectors}
            value={collectedBy}
            onChange={setCollectedBy}
            currentUserId={user.id}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Every bucket in a collection as it goes to the worker. */
function entryList(collection: Collection) {
  return collection.entries.map((item) => ({ bucketId: item.bucketId, lbs: item.lbs, collectedBy: item.collectedBy }));
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
  const { user } = useSession();
  const stations = useStationCards();
  const collectors = useCollectors();
  const [date, setDate] = useState(collection.date);
  const [batchId, setBatchId] = useState(
    day.batches.find((batch) => batch.batchNumber === collection.batchName)?.id ?? "",
  );
  const [loggedBy, setLoggedBy] = useState(collection.loggedBy);
  const [notes, setNotes] = useState(collection.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CollectionEntry | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [removing, setRemoving] = useState<CollectionEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const number = String(collection.collectionNumber).padStart(2, "0");
  // Buckets not in this collection yet, whose sensor is working.
  const addable = stations.filter(
    (station) =>
      station.status !== "offline" &&
      !station.alerts.some((alert) => alert.kind === "sensor") &&
      !collection.entries.some((entry) => entry.bucketId === station.bucketId),
  );
  const addingStation = stations.find((station) => station.bucketId === adding) ?? null;

  async function save() {
    setSaving(true);
    const ok = await send("PATCH", `/collections/${collection.id}`, {
      date,
      batchId: batchId || null,
      loggedBy,
      notes,
      by: user.name,
    });
    setSaving(false);
    if (ok) onClose();
  }

  /** Takes one bucket out of the collection; the rest stay. */
  async function removeEntry(entry: CollectionEntry) {
    const rest = entryList(collection).filter((item) => item.bucketId !== entry.bucketId);
    const ok = await send("PATCH", `/collections/${collection.id}`, { entries: rest, by: user.name });
    if (ok) setRemoving(null);
  }

  async function deleteCollection() {
    if (await send("DELETE", `/collections/${collection.id}`)) onClose();
  }

  return (
    <Modal
      title={`Edit Collection #${number}`}
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          <Button variant="outline" className="border-border text-text" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Date">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm text-muted">Buckets in this collection</span>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {collection.entries.map((entry) => (
              <li key={entry.bucketId} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-body font-semibold">{entry.bucketName}</span>
                  <span className="block text-sm text-muted">{entry.collectedBy || "—"}</span>
                </span>
                <span className="font-sans text-body font-semibold">{entry.lbs} lbs</span>
                <button
                  type="button"
                  onClick={() => setEditing(entry)}
                  className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-text"
                  aria-label={`Edit ${entry.bucketName}`}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setRemoving(entry)}
                  className="rounded-lg p-1.5 text-muted hover:bg-attention-bg hover:text-status-problem"
                  aria-label={`Remove ${entry.bucketName} from this collection`}
                >
                  <CloseIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
          {/* Add one more bucket: pick it, then its weight and who collected it. */}
          <select
            value=""
            disabled={addable.length === 0}
            onChange={(event) => event.target.value && setAdding(Number(event.target.value))}
            className={`${inputClass} mt-2`}
            aria-label="Add a bucket to this collection"
          >
            <option value="" disabled>
              {addable.length === 0 ? "Every working bucket is in this collection" : "+ Add Bucket"}
            </option>
            {addable.map((station) => (
              <option key={station.bucketId} value={station.bucketId}>
                {station.name} · {station.location}
              </option>
            ))}
          </select>
        </div>

        <Field label="Batch">
          <select value={batchId} onChange={(event) => setBatchId(event.target.value)} className={inputClass}>
            <option value="">Not in a batch</option>
            {day.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batchNumber} ({batchStatusLabel[batch.status]})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Logged by">
          <PersonPicker
            label="Logged by"
            people={collectors}
            value={loggedBy}
            onChange={setLoggedBy}
            currentUserId={user.id}
          />
        </Field>

        <Field label="Notes">
          <textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observations, conditions…"
            className={`${inputClass} resize-none`}
          />
        </Field>
      </div>

      {editing ? (
        <BucketEntryPopup
          title={`Edit ${editing.bucketName}`}
          initialLbs={editing.lbs}
          initialCollectedBy={editing.collectedBy}
          submitLabel="Save"
          onClose={() => setEditing(null)}
          onSubmit={(lbs, collectedBy) =>
            send("PATCH", `/collections/${collection.id}`, {
              entries: entryList(collection).map((item) =>
                item.bucketId === editing.bucketId ? { bucketId: item.bucketId, lbs, collectedBy } : item,
              ),
              by: user.name,
            })
          }
        />
      ) : null}
      {addingStation ? (
        <BucketEntryPopup
          title={`Add ${addingStation.name}`}
          initialLbs={addingStation.currentLbs}
          initialCollectedBy={loggedBy}
          submitLabel="Add"
          onClose={() => setAdding(null)}
          onSubmit={(lbs, collectedBy) =>
            send("PATCH", `/collections/${collection.id}`, {
              entries: [...entryList(collection), { bucketId: addingStation.bucketId, lbs, collectedBy }],
              by: user.name,
            })
          }
        />
      ) : null}
      {removing ? (
        collection.entries.length === 1 ? (
          <ConfirmModal
            title={`Delete Collection #${number}?`}
            message={`${removing.bucketName} is the only bucket in it, so removing it deletes the whole collection. This cannot be undone.`}
            confirmLabel="Delete Collection"
            danger
            onCancel={() => setRemoving(null)}
            onConfirm={deleteCollection}
          />
        ) : (
          <ConfirmModal
            title={`Remove ${removing.bucketName}?`}
            message={`Only ${removing.bucketName} (${removing.lbs} lbs) comes out of this collection. The other buckets stay.`}
            confirmLabel="Remove Bucket"
            danger
            onCancel={() => setRemoving(null)}
            onConfirm={() => void removeEntry(removing)}
          />
        )
      ) : null}
      {confirmDelete ? (
        <ConfirmModal
          title={`Delete Collection #${number}?`}
          message="Every bucket in it is removed from the records. This cannot be undone."
          confirmLabel="Delete Collection"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={deleteCollection}
        />
      ) : null}
    </Modal>
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

  const { can, user } = useSession();
  const { send } = useLive();
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

      {showAdd ? <LogCollectionModal bucketId={null} onClose={() => setShowAdd(false)} /> : null}
      {editCollection ? (
        <EditCollectionSheet collection={editCollection} day={day} onClose={() => setEditCollectionId(null)} />
      ) : null}
      {editRowCollection && editRowEntry ? (
        <BucketEntryPopup
          title={`Edit ${editRowEntry.bucketName}`}
          initialLbs={editRowEntry.lbs}
          initialCollectedBy={editRowEntry.collectedBy}
          submitLabel="Save"
          onClose={() => setEditRowKey(null)}
          onSubmit={(lbs, collectedBy) =>
            send("PATCH", `/collections/${editRowCollection.id}`, {
              entries: entryList(editRowCollection).map((item) =>
                item.bucketId === editRowEntry.bucketId ? { bucketId: item.bucketId, lbs, collectedBy } : item,
              ),
              by: user.name,
            })
          }
        />
      ) : null}
    </div>
  );
}
