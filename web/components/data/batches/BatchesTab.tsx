"use client";

import { useState } from "react";
import { useShows } from "@/components/auth/AccessContext";
import BatchCard from "@/components/data/batches/BatchCard";
import CreateBatchModal from "@/components/data/batches/CreateBatchModal";
import { useRecords } from "@/components/data/RecordsContext";

export default function BatchesTab() {
  const { batches } = useRecords();
  const [showAdd, setShowAdd] = useState(false);
  // Who sees the batch buttons: worker/src/rbac.config.js COMPONENTS.
  const isAdmin = useShows("data.batches.manage");

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
