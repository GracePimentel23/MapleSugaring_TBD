"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DemoDay } from "@/lib/demo/timeline";

export default function Overview({ day }: { day: DemoDay }) {
  const seasons = day.seasons;
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]!.season);
  const season = seasons.find((item) => item.season === selectedSeason) ?? seasons[0]!;

  const chartData = season.weeklyFlow.map((point) => ({
    week: point.week,
    Sap: point.lbs,
    Temp: point.temp,
  }));

  const peakLbs = season.weeklyFlow.length
    ? Math.max(...season.weeklyFlow.map((point) => point.lbs))
    : 0;

  return (
    <div className="max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Full season summary and sap flow</p>
        <select
          value={selectedSeason}
          onChange={(event) => setSelectedSeason(event.target.value)}
          className="rounded-xl border bg-white px-3 py-2 font-sans text-sm text-text outline-none"
          style={{ borderColor: "var(--color-border)" }}
        >
          {seasons.map((item) => (
            <option key={item.season} value={item.season}>
              {item.season}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Total Sap Collected",
            value: `${season.totalSapLbs} lbs`,
            sub: "this season",
          },
          {
            label: "Total Syrup Produced",
            value: `${season.totalSyrupLbs} lbs`,
            sub: `${season.totalBatches} batch${season.totalBatches === 1 ? "" : "es"}`,
          },
          {
            label: "Average Brix",
            value: season.avgBrix > 0 ? `${season.avgBrix}°` : "—",
            sub: "sugar content",
          },
          {
            label: "Sap → Syrup Ratio",
            value: season.sapToSyrupRatio > 0 ? `${season.sapToSyrupRatio}:1` : "—",
            sub: "lbs sap per lb syrup",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="flex flex-col justify-between rounded-2xl bg-white px-4 py-5 shadow-sm"
            style={{ border: "1px solid var(--color-border)", minHeight: 100 }}
          >
            <div className="mb-2 text-xs text-muted">{card.label}</div>
            <div>
              <div className="font-sans text-2xl font-bold">{card.value}</div>
              <div className="mt-0.5 text-xs text-muted">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl bg-white p-4 shadow-sm"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-sans text-sm font-semibold">{season.season} Sap Flow</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span className="text-muted">Avg Temp</span>
              <span className="font-semibold">{season.avgTempF}°F</span>
            </span>
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span className="text-muted">Peak</span>
              <span className="font-semibold">{peakLbs} lbs</span>
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EAD6" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="sap"
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => `${value} lbs`}
              width={48}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => `${value}°`}
              width={32}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 10,
                border: "none",
                background: "#1C1C1E",
                color: "#fff",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#9CA3AF", marginBottom: 4 }}
            />
            <Line
              yAxisId="sap"
              type="monotone"
              dataKey="Sap"
              name="Sap (lbs)"
              stroke="#2B4A1E"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#2B4A1E" }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="Temp"
              name="Temp (°F)"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ background: "#2B4A1E" }}
            />
            Sap (lbs)
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ background: "#F59E0B" }}
            />
            Temp (°F)
          </span>
        </div>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: "rgba(43,74,30,0.07)",
          border: "1px solid rgba(43,74,30,0.18)",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">🍁</span>
          <div>
            <p className="mb-1 font-sans text-sm font-semibold">
              {season.sapToSyrupRatio > 0
                ? `~${season.sapToSyrupRatio} lbs of sap → 1 lb of syrup`
                : "No syrup finished yet this season"}
            </p>
            <p className="text-xs leading-relaxed text-muted">
              {season.avgBrix > 0
                ? `This season's average Brix of ${season.avgBrix}° is within the ideal 66-68° range for Grade A maple syrup. Higher sugar content means a better ratio and more syrup per collection.`
                : "Once the first batch comes off the evaporator we can measure Brix and report the sap-to-syrup ratio here. The ideal range for Grade A syrup is 66-68°."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
