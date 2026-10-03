"use client";

import { PEOPLE } from "@/components/data/collections/people";
import { useRecords } from "@/components/data/RecordsContext";
import { CloseIcon } from "@/components/ui/icons";
import { useFormSubmit } from "@/hooks/useFormSubmit";

export default function AddCollectionSheet({ onClose }: { onClose: () => void }) {
  const { batches, bucketOptions, recordsDate } = useRecords();
  const { onSubmit, error, saving } = useFormSubmit(onClose, (values, form) => ({
    method: "POST",
    path: "/collections",
    body: {
      date: values.date,
      // Each bucket is logged at its current load cell weight.
      bucketIds: new FormData(form).getAll("bucketId").map(Number),
      batchId: values.batchId,
      loggedBy: values.loggedBy,
      notes: values.notes,
    },
  }));

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
        <form onSubmit={onSubmit}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date</label>
            <input
              name="date"
              type="date"
              defaultValue={recordsDate}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Buckets (select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {bucketOptions.map((profile) => (
                <label
                  key={profile.bucketId}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs"
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <input
                    type="checkbox"
                    name="bucketId"
                    value={profile.bucketId}
                    className="accent-green-800"
                  /> {profile.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Batch</label>
            <select
              name="batchId"
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option value="">— Unassigned —</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batchNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Logged By</label>
            <select
              name="loggedBy"
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
              name="notes"
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
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            Save
          </button>
        </div>
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
