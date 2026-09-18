"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyCollectionPoint } from "@/lib/types/schema";

export default function SapCollectedChart({
  data,
}: {
  data: WeeklyCollectionPoint[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(28,28,30,0.04)]">
      <h2 className="font-sans text-base font-semibold text-text">Sap Collected</h2>
      <p className="mb-4 text-xs text-muted">Daily sap collection over one week.</p>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={48} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E7E2D4" strokeDasharray="3 6" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              domain={[0, 8]}
              ticks={[0, 2, 4, 6, 8]}
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => `${value} lbs`}
              width={52}
            />
            <Bar dataKey="lbs" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={entry.day === "Today" ? "#6B9E45" : "#3D6B28"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
