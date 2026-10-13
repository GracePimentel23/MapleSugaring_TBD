"use client";

import AlertIcon from "@/components/alerts/AlertIcon";
import { CheckCircleIcon } from "@/components/icons";
import { useStationState } from "@/components/stations/StationStateProvider";
import type { ClubAlert } from "@/lib/types/schema";

/** Unacknowledged alerts. The check mark acknowledges one ("someone is on it"). */
export default function NeedsAttention({ alerts }: { alerts: ClubAlert[] }) {
  const { acknowledge } = useStationState();

  if (alerts.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-white px-6 py-4">
        <span className="text-accent-mid">
          <CheckCircleIcon size={24} />
        </span>
        <p className="font-sans text-base font-semibold">All clear. Nothing needs attention.</p>
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-attention-border bg-attention-bg px-5 pt-5 pb-2 md:px-7">
      <h2 className="mb-1 font-sans text-base font-semibold text-status-problem md:text-lg">
        Needs Attention · {alerts.length}
      </h2>
      <ul>
        {alerts.map((alert) => (
          <li
            key={alert.key}
            className="flex items-center gap-4 border-b border-attention-border/70 py-4 last:border-0"
          >
            <AlertIcon kind={alert.kind} />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-base font-semibold md:text-lg">{alert.title}</p>
              <p className="text-sm text-muted md:text-[15px]">{alert.advice}</p>
            </div>
            <button
              type="button"
              onClick={() => acknowledge(alert)}
              aria-label={`Acknowledge: ${alert.title}`}
              title="Acknowledge"
              className="shrink-0 rounded-full p-1 text-accent-mid transition-colors hover:bg-white"
            >
              <CheckCircleIcon size={28} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
