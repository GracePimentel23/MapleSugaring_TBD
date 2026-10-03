"use client";

import { useState } from "react";
import { PEOPLE } from "@/components/data/collections/people";
import { useRecords } from "@/components/data/RecordsContext";
import { CloseIcon } from "@/components/ui/icons";
import type { Collection } from "@/lib/types/schema";

export default function EditCollectionSheet({
  collection,
  onClose,
}: {
  collection: Collection;
  onClose: () => void;
}) {
  const { batches, bucketOptions } = useRecords();
  const [removedBuckets, setRemovedBuckets] = useState<string[]>([]);
  const waitingBatches = batches.filter(
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
              {bucketOptions.map((profile, index) => {
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
              {batches.map((batch) => (
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
