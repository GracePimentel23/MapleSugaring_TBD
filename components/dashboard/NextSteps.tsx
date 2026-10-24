"use client";

import { useState } from "react";
import { useBatchState } from "@/components/data/BatchStateProvider";
import { useDemo } from "@/components/demo/DemoProvider";
import { CheckIcon } from "@/components/icons";
import { cx } from "@/components/ui/ui";
import { byUrgency } from "@/lib/selectors/stations";
import type { StationView } from "@/lib/types/schema";

interface Step {
  key: string;
  title: string;
  detail: string;
}

/** A short to-do list built from what the stations and batches need today. */
function buildSteps(stations: StationView[], batches: { batchNumber: string; status: string }[]): Step[] {
  const steps: Step[] = [];

  for (const station of [...stations].sort(byUrgency)) {
    if (station.status === "full" || station.status === "due") {
      steps.push({
        key: `collect-${station.bucketId}`,
        title: `Collect ${station.name}`,
        detail: `${station.location} · ${station.status === "full" ? "full now" : "due now"}`,
      });
    }
    if (station.alerts.some((alert) => alert.kind === "battery")) {
      steps.push({
        key: `battery-${station.bucketId}`,
        title: `Replace ${station.name} battery`,
        detail: station.location,
      });
    }
    if (station.status === "offline") {
      steps.push({
        key: `sensor-${station.bucketId}`,
        title: `Check ${station.name} sensor`,
        detail: `${station.location} · no signal`,
      });
    }
  }

  for (const batch of batches) {
    if (batch.status === "processing") {
      steps.push({
        key: `boil-${batch.batchNumber}`,
        title: `Check ${batch.batchNumber} on the evaporator`,
        detail: "Boiling",
      });
    }
    if (batch.status === "waiting") {
      steps.push({
        key: `wait-${batch.batchNumber}`,
        title: `Start boiling ${batch.batchNumber}`,
        detail: "Waiting in storage",
      });
    }
  }

  return steps;
}

export default function NextSteps({ stations }: { stations: StationView[] }) {
  const { day, dayIndex } = useDemo();
  const { viewBatch } = useBatchState();
  const [done, setDone] = useState<Record<string, boolean>>({});

  const steps = buildSteps(
    stations,
    day.batches.map(viewBatch).map((view) => view.batch),
  );

  return (
    <section className="rounded-2xl border border-border bg-white p-5 md:p-6">
      <h2 className="border-b border-border pb-3 font-sans text-lg font-semibold">Next Steps</h2>
      {steps.length === 0 ? (
        <p className="pt-4 text-body text-muted">Nothing to do right now.</p>
      ) : (
        <ul>
          {steps.map((step) => {
            // Ticks are per demo day, so tomorrow starts with a fresh list.
            const id = `${dayIndex}:${step.key}`;
            const checked = Boolean(done[id]);
            return (
              <li key={step.key} className="border-b border-border last:border-0">
                <label className="flex cursor-pointer items-start gap-3 py-4">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setDone((current) => ({ ...current, [id]: !checked }))}
                    className="peer sr-only"
                  />
                  <span
                    className={cx(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent-mid",
                      checked ? "border-accent-mid bg-accent-mid text-white" : "border-[#9CA39A] bg-white",
                    )}
                  >
                    {checked ? <CheckIcon size={14} /> : null}
                  </span>
                  <span className={cx(checked && "text-muted line-through")}>
                    <span className="block font-sans text-base font-semibold md:text-lg">{step.title}</span>
                    <span className="block text-body text-muted">{step.detail}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
