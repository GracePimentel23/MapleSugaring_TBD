"use client";

import { CloseIcon } from "@/components/ui/icons";
import { useFormSubmit } from "@/hooks/useFormSubmit";

export default function AddStationModal({ onClose }: { onClose: () => void }) {
  const { onSubmit, error, saving } = useFormSubmit(onClose, (values) => ({
    method: "POST",
    path: "/stations",
    body: {
      name: values.name,
      location: values.location,
      capacityLbs: values.capacityLbs,
      nodeCode: values.nodeCode,
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
          <h3 className="font-sans text-base font-semibold">Add Station</h3>
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
          {[
            { name: "name", label: "Bucket Name", placeholder: "e.g. Bucket #06", type: "text" },
            { name: "location", label: "Location", placeholder: "e.g. East Slope", type: "text" },
            { name: "capacityLbs", label: "Target Weight (lbs)", placeholder: "12", type: "number" },
            { name: "nodeCode", label: "Sensor ID (optional)", placeholder: "e.g. LC02", type: "text" },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-xs font-medium text-muted">
                {field.label}
              </label>
              <input
                name={field.name}
                type={field.type}
                step={field.type === "number" ? "any" : undefined}
                required={field.name === "name"}
                placeholder={field.placeholder}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          ))}
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
            Add Station
          </button>
        </div>
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
