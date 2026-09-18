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
      <h2 className="font-sans text-base font-semibold text-text">Production Summary</h2>
      <div className="mb-3 text-xs text-muted">{periodLabel}</div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-white px-4 py-3 shadow-[0_1px_2px_rgba(28,28,30,0.04)]"
          >
            <div className="mb-1 text-xs text-muted">{item.label}</div>
            <div className="font-sans text-xl font-semibold tracking-tight">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
