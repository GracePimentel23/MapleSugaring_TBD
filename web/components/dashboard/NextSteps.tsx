"use client";

import Link from "next/link";
import { useState } from "react";
import AlertIcon from "@/components/alerts/AlertIcon";
import ResolveAlertModal from "@/components/alerts/ResolveAlertModal";
import { useBatchState } from "@/components/data/BatchStateProvider";
import { useLive } from "@/components/live/LiveProvider";
import { ChevronRightIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { useAlerts } from "@/components/stations/StationStateProvider";

/** Boiling reminders: batches are not alerts, so these link to the Batches page instead. */
function batchSteps(batches: { batchNumber: string; status: string }[]) {
  return batches.flatMap((batch) =>
    batch.status === "processing"
      ? [{ key: `boil-${batch.batchNumber}`, title: `Check ${batch.batchNumber} on the evaporator`, detail: "Boiling" }]
      : batch.status === "waiting"
        ? [
            {
              key: `wait-${batch.batchNumber}`,
              title: `Start boiling ${batch.batchNumber}`,
              detail: "Waiting in storage",
            },
          ]
        : [],
  );
}

/**
 * What needs doing: every active alert, each with a Next Step button that opens the same resolve
 * pop-up as the Alerts page, then boiling reminders for the batches.
 */
export default function NextSteps() {
  const { day } = useLive();
  const { can } = useSession();
  const { viewBatch } = useBatchState();
  const { active } = useAlerts();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const opened = active.find((alert) => alert.key === openKey) ?? null;
  const batches = batchSteps(day.batches.map(viewBatch).map((view) => view.batch));
  const canResolve = can("alerts:resolve");

  return (
    <section className="rounded-2xl border border-border bg-white p-5 md:p-6">
      <h2 className="border-b border-border pb-3 font-sans text-lg font-semibold">Next Steps</h2>
      {active.length + batches.length === 0 ? (
        <p className="pt-4 text-body text-muted">Nothing to do right now.</p>
      ) : (
        <ul>
          {active.map((alert) => (
            <li key={alert.key} className="border-b border-border last:border-0">
              <div className="flex items-start gap-3 py-4">
                <span className="mt-0.5">
                  <AlertIcon kind={alert.kind} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-base font-semibold">{alert.title}</span>
                  <span className="block text-body text-muted">{alert.advice}</span>
                  {canResolve ? (
                    <button
                      type="button"
                      onClick={() => setOpenKey(alert.key)}
                      className="mt-2 flex items-center gap-1 rounded-full border border-border px-3 py-1 font-sans text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent-light"
                    >
                      {alert.kind === "weather" ? "Read and Acknowledge" : "Next Step"}
                      <ChevronRightIcon size={16} />
                    </button>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
          {batches.map((step) => (
            <li key={step.key} className="border-b border-border last:border-0">
              <Link href="/data/batches" className="group flex items-start gap-3 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-base font-semibold group-hover:underline">{step.title}</span>
                  <span className="block text-body text-muted">{step.detail}</span>
                </span>
                <ChevronRightIcon size={18} className="mt-1 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {opened ? <ResolveAlertModal alert={opened} onClose={() => setOpenKey(null)} /> : null}
    </section>
  );
}
