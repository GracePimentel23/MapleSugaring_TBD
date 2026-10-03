import { formatDate } from "@/lib/dates";
import type { Batch, BatchStatus } from "@/lib/types/schema";

const statusStyles: Record<BatchStatus, { bg: string; color: string; label: string }> = {
  completed: { bg: "rgba(34,197,94,0.1)", color: "#16A34A", label: "Completed" },
  processing: { bg: "rgba(245,158,11,0.1)", color: "#D97706", label: "Processing" },
  active: { bg: "rgba(59,130,246,0.1)", color: "#2563EB", label: "Active" },
  waiting: { bg: "rgba(107,114,128,0.1)", color: "#6B7280", label: "Waiting" },
};

export default function BatchCard({ batch, isAdmin }: { batch: Batch; isAdmin: boolean }) {
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
