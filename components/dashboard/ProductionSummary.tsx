import type { ProductionStat } from "@/lib/types/schema";

export default function ProductionSummary({
  periodLabel,
  items,
}: {
  periodLabel: string;
  items: ProductionStat[];
}) {
  return (
    <div className="mb-5">
      <h2 className="mb-1 font-sans text-base font-semibold">Production Summary</h2>
      <div className="mb-3 text-xs text-muted">{periodLabel}</div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-white px-4 py-3 shadow-sm"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <div className="mb-1 text-xs text-muted">{item.label}</div>
            <div className="font-sans text-xl font-bold">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
