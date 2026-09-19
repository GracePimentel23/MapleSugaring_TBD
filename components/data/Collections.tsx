"use client";

import { useState } from "react";
import { bucketProfiles } from "@/lib/demo/profiles";
import type { DemoDay } from "@/lib/demo/timeline";
import type { Collection, CollectionEntry, UserRole } from "@/lib/types/schema";

const PEOPLE = ["Mr. Adams", "Chloe M.", "Jordan T.", "Sam R."];

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
      <path
        d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
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

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditRowPopup({
  entry,
  onClose,
}: {
  entry: CollectionEntry;
  onClose: () => void;
}) {
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
          <h4 className="font-sans text-sm font-semibold">Edit Entry</h4>
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
            <label className="mb-1 block text-xs font-medium text-muted">Bucket</label>
            <input
              defaultValue={entry.bucketName}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Weight (lbs)
            </label>
            <input
              type="number"
              defaultValue={entry.lbs}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border py-2 text-xs font-semibold"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2 text-xs font-semibold text-white"
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
  day: DemoDay;
  onClose: () => void;
}) {
  const [removedBuckets, setRemovedBuckets] = useState<string[]>([]);
  const waitingBatches = day.batches.filter(
    (batch) => batch.status === "waiting" || batch.status === "active",
  );

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
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date</label>
            <input
              type="date"
              defaultValue={collection.date}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted">Buckets</label>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--color-border)" }}
            >
              {bucketProfiles.map((profile, index) => {
                const included = collection.entries.some(
                  (entry) => entry.bucketName === profile.name,
                );
                const removed = removedBuckets.includes(profile.name);

                return (
                  <div
                    key={profile.bucketId}
                    className="flex items-center justify-between px-3 py-2.5 text-sm"
                    style={{
                      background: index % 2 === 0 ? "white" : "#F5F5F5",
                      borderTop: index > 0 ? "1px solid var(--color-border)" : "none",
                    }}
                  >
                    <span
                      style={{
                        color: removed ? "var(--color-muted)" : "var(--color-text)",
                        textDecoration: removed ? "line-through" : "none",
                      }}
                    >
                      {profile.name}
                    </span>
                    {included ? (
                      <button
                        type="button"
                        onClick={() =>
                          setRemovedBuckets((current) =>
                            removed
                              ? current.filter((name) => name !== profile.name)
                              : [...current, profile.name],
                          )
                        }
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{
                          color: removed ? "#16A34A" : "#DC2626",
                          background: removed
                            ? "rgba(34,197,94,0.1)"
                            : "rgba(239,68,68,0.1)",
                        }}
                      >
                        {removed ? "Restore" : "Remove"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{ color: "#2B4A1E", background: "rgba(43,74,30,0.1)" }}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Batch</label>
            <select
              defaultValue={collection.batchName}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-text outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option value="">— Unassigned —</option>
              {day.batches.map((batch) => (
                <option key={batch.id} value={batch.batchNumber}>
                  {batch.batchNumber} ({batch.status})
                </option>
              ))}
            </select>
            {waitingBatches.length > 0 ? (
              <p className="mt-1 text-xs text-muted">
                Batches waiting for sap:{" "}
                {waitingBatches.map((batch) => batch.batchNumber).join(", ")}
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Logged By</label>
            <select
              defaultValue={collection.loggedBy}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-text outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              {PEOPLE.map((person) => (
                <option key={person}>{person}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Notes</label>
            <textarea
              rows={2}
              defaultValue={collection.notes}
              placeholder="Observations, conditions…"
              className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
        </div>

        <div
          className="flex shrink-0 gap-2 border-t px-5 py-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
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
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCollectionSheet({ day, onClose }: { day: DemoDay; onClose: () => void }) {
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
          <h3 className="font-sans text-base font-semibold">Add Collection</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date</label>
            <input
              type="date"
              defaultValue={day.date}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Buckets (select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {bucketProfiles.map((profile) => (
                <label
                  key={profile.bucketId}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs"
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <input type="checkbox" className="accent-green-800" /> {profile.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Batch</label>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option>— Unassigned —</option>
              {day.batches.map((batch) => (
                <option key={batch.id}>{batch.batchNumber}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Logged By</label>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              {PEOPLE.map((person) => (
                <option key={person}>{person}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Weather, observations…"
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Collections({
  day,
  role,
}: {
  day: DemoDay;
  role: UserRole;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editCollectionId, setEditCollectionId] = useState<string | null>(null);
  const [editRowKey, setEditRowKey] = useState<{
    collectionId: string;
    bucketId: number;
  } | null>(null);

  const canAdd = role === "admin" || role === "student";
  const isAdmin = role === "admin";

  // Resolved from the current day so an open sheet follows the replay rather
  // than holding a stale snapshot.
  const editCollection =
    day.collections.find((collection) => collection.id === editCollectionId) ?? null;
  const editRowEntry =
    day.collections
      .find((collection) => collection.id === editRowKey?.collectionId)
      ?.entries.find((entry) => entry.bucketId === editRowKey?.bucketId) ?? null;

  return (
    <div className="max-w-3xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-xl font-semibold">Collections</h2>
          <p className="mt-0.5 text-xs text-muted">
            {day.collections.length} collection
            {day.collections.length === 1 ? "" : "s"} · most recent first
          </p>
        </div>
        {canAdd ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            <span className="text-base leading-none">+</span> Add Collection
          </button>
        ) : null}
      </div>

      {day.collections.length === 0 ? (
        <div className="py-16 text-center text-muted">
          <div className="mb-3 text-4xl">🪣</div>
          <p className="text-sm font-medium">No collections logged yet</p>
          <p className="mt-1 text-xs">
            The buckets are still filling - nothing has been emptied into storage.
          </p>
        </div>
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
                      <div className="font-sans text-sm font-semibold">
                        {formatDate(collection.date)}
                      </div>
                      <div className="text-xs text-muted">
                        {collection.entries.length} bucket
                        {collection.entries.length === 1 ? "" : "s"} ·{" "}
                        {collection.batchName}
                      </div>
                    </div>
                  </button>

                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="font-sans text-sm font-bold">
                      {collection.totalLbs} lbs
                    </span>
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
                        className="border-t px-4 py-3 text-xs text-muted"
                        style={{ borderColor: "var(--color-border)", background: "#F5F5F5" }}
                      >
                        📝 {collection.notes}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {showAdd ? <AddCollectionSheet day={day} onClose={() => setShowAdd(false)} /> : null}
      {editCollection ? (
        <EditCollectionSheet
          collection={editCollection}
          day={day}
          onClose={() => setEditCollectionId(null)}
        />
      ) : null}
      {editRowEntry ? (
        <EditRowPopup entry={editRowEntry} onClose={() => setEditRowKey(null)} />
      ) : null}
    </div>
  );
}
