"use client";

import { CloseIcon } from "@/components/ui/icons";
import { useFormSubmit } from "@/hooks/useFormSubmit";

export default function CreateBatchModal({ onClose }: { onClose: () => void }) {
  const { onSubmit, error, saving } = useFormSubmit(onClose, (values) => ({
    method: "POST",
    path: "/batches",
    body: {
      date: values.date,
      sapInLbs: values.sapInLbs,
      syrupOutLbs: values.syrupOutLbs,
      brix: values.brix,
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
          <h3 className="font-sans text-base font-semibold">Create Batch</h3>
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
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Sap In (lbs)
            </label>
            <input
              name="sapInLbs"
              type="number"
              step="any"
              placeholder="0.0"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Syrup Out (lbs)
              </label>
              <input
                name="syrupOutLbs"
                type="number"
                step="any"
                placeholder="0.0"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Brix (°)</label>
              <input
                name="brix"
                type="number"
                step="any"
                placeholder="66.0"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Notes</label>
            <textarea
              name="notes"
              rows={2}
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
            Save Batch
          </button>
        </div>
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
