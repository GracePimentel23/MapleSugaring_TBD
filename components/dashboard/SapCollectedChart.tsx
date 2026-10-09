"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { WeeklyCollectionPoint } from "@/lib/types/schema";
import { formatLbs } from "@/lib/units";

/** How long a tapped value stays up on touch screens. */
const TAP_LABEL_MS = 2000;

interface ActiveBar {
  index: number;
  /** Bar geometry in chart pixels, so the label can sit right above it */
  x: number;
  y: number;
  width: number;
}

export default function SapCollectedChart({
  data,
}: {
  data: WeeklyCollectionPoint[];
}) {
  const [active, setActive] = useState<ActiveBar | null>(null);
  const pointerType = useRef<string>("mouse");
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  function show(bar: { x?: number; y?: number; width?: number }, index: number) {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    // Dimming the other bars re-renders the bar under the cursor, which fires
    // another enter; keep the same state object so that doesn't loop.
    setActive((current) =>
      current?.index === index
        ? current
        : { index, x: bar.x ?? 0, y: bar.y ?? 0, width: bar.width ?? 0 },
    );
  }

  const activePoint = active ? data[active.index] : undefined;

  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <h2 className="mb-0.5 font-sans text-base font-semibold">Sap Collected</h2>
      <p className="mb-4 text-xs text-muted">Daily sap collection over one week.</p>
      <div
        className="relative"
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
      >
        {active && activePoint ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg px-2 py-1 text-xs font-semibold whitespace-nowrap text-white"
            style={{
              left: active.x + active.width / 2,
              top: active.y - 6,
              background: "var(--color-text)",
            }}
          >
            {formatLbs(activePoint.lbs)}
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barSize={28} margin={{ top: 28, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => `${value} lbs`}
              width={44}
            />
            <Bar
              dataKey="lbs"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              cursor="pointer"
              // Web: shown while the mouse is over the bar.
              onMouseEnter={(bar, index) => {
                if (pointerType.current !== "touch") show(bar, index);
              }}
              onMouseLeave={() => {
                if (pointerType.current !== "touch") setActive(null);
              }}
              // Mobile: a tap shows the value, then it fades after two seconds.
              onClick={(bar, index) => {
                show(bar, index);
                if (pointerType.current === "touch") {
                  tapTimer.current = setTimeout(() => setActive(null), TAP_LABEL_MS);
                }
              }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`${entry.day}-${index}`}
                  fill={entry.day === "Today" ? "#6B9E45" : "#3D6B28"}
                  fillOpacity={active && active.index !== index ? 0.55 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
