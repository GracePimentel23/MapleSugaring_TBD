"use client";

import { useState } from "react";
import type { DemoDay } from "@/lib/demo/timeline";
import type { Batch, BatchStatus, UserRole } from "@/lib/types/schema";

const statusStyles: Record<BatchStatus, { bg: string; color: string; label: string }> = {
  completed: { bg: "rgba(34,197,94,0.1)", color: "#16A34A", label: "Completed" },
  processing: { bg: "rgba(245,158,11,0.1)", color: "#D97706", label: "Processing" },
  active: { bg: "rgba(59,130,246,0.1)", color: "#2563EB", label: "Active" },
  waiting: { bg: "rgba(107,114,128,0.1)", color: "#6B7280", label: "Waiting" },
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function BatchCard({ batch, isAdmin }: { batch: Batch; isAdmin: boolean }) {
  const style = statusStyles[batch.status];

  return (
    <div
      className="rounded-2xl bg-white px-4 py-4 shadow-sm"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <span className="font-sans text-sm font-bold">{batch.batchNumber}</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: style.bg, color: style.color }}
            >
              {style.label}
            </span>
          </div>
          <div className="text-xs text-muted">
            {formatDate(batch.date)} · {batch.createdBy}
          </div>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="rounded-lg border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-gray-50"
            style={{ borderColor: "var(--color-border)" }}
          >
            Edit
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Sap In", value: `${batch.sapInLbs} lbs` },
          {
            label: "Syrup Out",
            value: batch.syrupOutLbs > 0 ? `${batch.syrupOutLbs} lbs` : "—",
          },
          { label: "Brix", value: batch.brix > 0 ? `${batch.brix}°` : "—" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl p-2.5"
            style={{ background: "var(--color-bg)" }}
          >
            <div className="mb-0.5 text-xs text-muted">{item.label}</div>
            <div className="font-sans text-sm font-bold">{item.value}</div>
          </div>
        ))}
      </div>

      {batch.status === "completed" && batch.syrupOutLbs > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          ⚖️ Ratio:{" "}
          <strong className="text-text">
            {(batch.sapInLbs / batch.syrupOutLbs).toFixed(1)}:1
          </strong>
        </div>
      ) : null}

      {batch.notes ? (
        <div
          className="mt-2.5 rounded-lg px-3 py-2 text-xs text-muted"
          style={{ background: "rgba(43,74,30,0.06)" }}
        >
          {batch.notes}
        </div>
      ) : null}
    </div>
  );
}

function CreateBatchModal({ onClose }: { onClose: () => void }) {
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date</label>
            <input
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
              type="number"
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
                type="number"
                placeholder="0.0"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Brix (°)</label>
              <input
                type="number"
                placeholder="66.0"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Notes</label>
            <textarea
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
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Save Batch
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Batches({ day, role }: { day: DemoDay; role: UserRole }) {
  const [showAdd, setShowAdd] = useState(false);
  const isAdmin = role === "admin";

  const batches = day.batches;
  const activeBatches = batches.filter(
    (batch) => batch.status === "active" || batch.status === "processing",
  );
  const waitingBatches = batches.filter((batch) => batch.status === "waiting");
  const doneBatches = batches.filter((batch) => batch.status === "completed");

  const totalSyrup = doneBatches.reduce((sum, batch) => sum + batch.syrupOutLbs, 0);
  const totalSap = batches.reduce((sum, batch) => sum + batch.sapInLbs, 0);
  const avgBrix = doneBatches.length
    ? doneBatches.reduce((sum, batch) => sum + batch.brix, 0) / doneBatches.length
    : 0;

  return (
    <div className="max-w-3xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-xl font-semibold">Batches</h2>
          <p className="mt-0.5 text-xs text-muted">
            {batches.length} batch{batches.length === 1 ? "" : "es"} this season
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            <span className="text-base leading-none">+</span> New Batch
          </button>
        ) : null}
      </div>

      {batches.length === 0 ? (
        <div className="py-16 text-center text-muted">
          <div className="mb-3 text-4xl">🍯</div>
          <p className="text-sm font-medium">No batches yet</p>
          <p className="mt-1 text-xs">
            A batch is created once sap has been collected into storage.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: "Total Sap In", value: `${totalSap.toFixed(1)} lbs` },
              { label: "Syrup Produced", value: `${totalSyrup.toFixed(1)} lbs` },
              {
                label: "Avg Brix",
                value: avgBrix > 0 ? `${avgBrix.toFixed(1)}°` : "—",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-white px-3 py-3 shadow-sm"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <div className="mb-0.5 text-xs text-muted">{item.label}</div>
                <div className="font-sans text-lg font-bold">{item.value}</div>
              </div>
            ))}
          </div>

          {activeBatches.length > 0 ? (
            <div className="mb-5">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "rgba(59,130,246,0.06)",
                  border: "1.5px solid rgba(59,130,246,0.2)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">🔵</span>
                  <h3 className="font-sans text-sm font-semibold">Active Batches</h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "rgba(59,130,246,0.12)", color: "#2563EB" }}
                  >
                    {activeBatches.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {activeBatches.map((batch) => (
                    <BatchCard key={batch.id} batch={batch} isAdmin={isAdmin} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {waitingBatches.length > 0 ? (
            <div className="mb-5">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "rgba(107,114,128,0.06)",
                  border: "1.5px solid rgba(107,114,128,0.2)",
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-base">⏳</span>
                  <h3 className="font-sans text-sm font-semibold">Waiting / Storage</h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "rgba(107,114,128,0.12)", color: "#6B7280" }}
                  >
                    {waitingBatches.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {waitingBatches.map((batch) => (
                    <BatchCard key={batch.id} batch={batch} isAdmin={isAdmin} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {doneBatches.length > 0 ? (
            <div>
              <h3 className="mb-3 font-sans text-sm font-semibold text-muted">
                Completed
              </h3>
              <div className="flex flex-col gap-2">
                {doneBatches.map((batch) => (
                  <BatchCard key={batch.id} batch={batch} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {showAdd && isAdmin ? <CreateBatchModal onClose={() => setShowAdd(false)} /> : null}
    </div>
  );
}
