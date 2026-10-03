"use client";

import { CloseIcon } from "@/components/ui/icons";
import type { CollectionEntry } from "@/lib/types/schema";

export default function EditEntryPopup({
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
