"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { WeeklyCollectionPoint } from "@/lib/types/schema";

export default function SapCollectedChart({
  data,
}: {
  data: WeeklyCollectionPoint[];
}) {
  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <h2 className="mb-0.5 font-sans text-base font-semibold">Sap Collected</h2>
      <p className="mb-4 text-xs text-muted">Daily sap collection over one week.</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barSize={28}>
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
          <Bar dataKey="lbs" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell
                key={`${entry.day}-${index}`}
                fill={entry.day === "Today" ? "#6B9E45" : "#3D6B28"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
