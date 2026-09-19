"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DemoDay } from "@/lib/demo/timeline";

const SEASON_COLORS: Record<string, string> = {
  "Season 2022": "#2B4A1E",
  "Season 2021": "#F59E0B",
  "Season 2020": "#6B7280",
};

function seasonColor(season: string, fallback: string): string {
  return SEASON_COLORS[season] ?? fallback;
}

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 10,
  border: "none",
  background: "#1C1C1E",
  color: "#fff",
  padding: "8px 12px",
};

export default function Analysis({ day }: { day: DemoDay }) {
  const seasons = day.seasons;
  const [primarySeason, setPrimarySeason] = useState(seasons[0]!.season);
  const [compareA, setCompareA] = useState(seasons[0]!.season);
  const [compareB, setCompareB] = useState(seasons[1]!.season);

  const primary = seasons.find((item) => item.season === primarySeason) ?? seasons[0]!;
  const seasonA = seasons.find((item) => item.season === compareA) ?? seasons[0]!;
  const resolvedB =
    compareB === compareA
      ? (seasons.find((item) => item.season !== compareA) ?? seasons[1]!)
      : (seasons.find((item) => item.season === compareB) ?? seasons[1]!);

  const primaryChart = primary.weeklyFlow.map((point) => ({
    week: point.week,
    Sap: point.lbs,
    Temp: point.temp,
  }));

  // Compare against the longer of the two series so neither gets truncated.
  const frame =
    seasonA.weeklyFlow.length >= resolvedB.weeklyFlow.length
      ? seasonA.weeklyFlow
      : resolvedB.weeklyFlow;

  const compareFlowData = frame.map((point, index) => ({
    week: point.week,
    [seasonA.season]: seasonA.weeklyFlow[index]?.lbs ?? null,
    [resolvedB.season]: resolvedB.weeklyFlow[index]?.lbs ?? null,
  }));

  const ratioData = [seasonA, resolvedB].map((season) => ({
    season: season.season.replace("Season ", ""),
    ratio: season.sapToSyrupRatio,
  }));

  const peakLbs = primary.weeklyFlow.length
    ? Math.max(...primary.weeklyFlow.map((point) => point.lbs))
    : 0;

  return (
    <div className="max-w-4xl space-y-6 p-4 md:p-6">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-sans text-base font-semibold">Season Summary</h2>
          <select
            value={primarySeason}
            onChange={(event) => setPrimarySeason(event.target.value)}
            className="rounded-xl border bg-white px-3 py-2 font-sans text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          >
            {seasons.map((season) => (
              <option key={season.season} value={season.season}>
                {season.season}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Sap", value: `${primary.totalSapLbs} lbs` },
            { label: "Total Syrup", value: `${primary.totalSyrupLbs} lbs` },
            { label: "Avg Brix", value: primary.avgBrix > 0 ? `${primary.avgBrix}°` : "—" },
            {
              label: "Sap→Syrup",
              value:
                primary.sapToSyrupRatio > 0 ? `${primary.sapToSyrupRatio}:1` : "—",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl bg-white px-3 py-3 shadow-sm"
              style={{ border: "1px solid var(--color-border)" }}
            >
              <div className="mb-0.5 text-xs text-muted">{card.label}</div>
              <div className="font-sans text-lg font-bold">{card.value}</div>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-sans text-sm font-semibold">
              {primary.season} Sap Flow
            </h3>
            <div className="flex items-center gap-2">
              <span
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span className="text-muted">Avg Temp</span>
                <span className="font-semibold">{primary.avgTempF}°F</span>
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

          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={primaryChart}>
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
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9CA3AF", marginBottom: 4 }} />
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
        </div>
      </section>

      <div style={{ height: 1, background: "var(--color-border)" }} />

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-sans text-base font-semibold">Compare Seasons</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={compareA}
              onChange={(event) => setCompareA(event.target.value)}
              className="rounded-xl border bg-white px-3 py-2 font-sans text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              {seasons.map((season) => (
                <option key={season.season} value={season.season}>
                  {season.season}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted">vs</span>
            <select
              value={resolvedB.season}
              onChange={(event) => setCompareB(event.target.value)}
              className="rounded-xl border bg-white px-3 py-2 font-sans text-sm outline-none"
              style={{ borderColor: "var(--color-border)" }}
            >
              {seasons
                .filter((season) => season.season !== compareA)
                .map((season) => (
                  <option key={season.season} value={season.season}>
                    {season.season}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: "Total Sap",
              a: `${seasonA.totalSapLbs} lbs`,
              b: `${resolvedB.totalSapLbs} lbs`,
            },
            {
              label: "Total Syrup",
              a: `${seasonA.totalSyrupLbs} lbs`,
              b: `${resolvedB.totalSyrupLbs} lbs`,
            },
            {
              label: "Avg Brix",
              a: seasonA.avgBrix > 0 ? `${seasonA.avgBrix}°` : "—",
              b: resolvedB.avgBrix > 0 ? `${resolvedB.avgBrix}°` : "—",
            },
            {
              label: "Ratio",
              a: seasonA.sapToSyrupRatio > 0 ? `${seasonA.sapToSyrupRatio}:1` : "—",
              b: resolvedB.sapToSyrupRatio > 0 ? `${resolvedB.sapToSyrupRatio}:1` : "—",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-white p-3 shadow-sm"
              style={{ border: "1px solid var(--color-border)" }}
            >
              <div className="mb-1.5 text-xs text-muted">{item.label}</div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span
                  className="text-sm font-bold"
                  style={{ color: seasonColor(seasonA.season, "#2B4A1E") }}
                >
                  {item.a}
                </span>
                <span className="text-xs text-muted">vs</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: seasonColor(resolvedB.season, "#F59E0B") }}
                >
                  {item.b}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mb-4 rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <h3 className="mb-4 font-sans text-sm font-semibold">
            Daily Sap Flow Comparison
          </h3>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={compareFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EAD6" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `${value} lbs`}
                width={48}
              />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9CA3AF", marginBottom: 4 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey={seasonA.season}
                stroke={seasonColor(seasonA.season, "#2B4A1E")}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={resolvedB.season}
                stroke={seasonColor(resolvedB.season, "#F59E0B")}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-2xl bg-white p-4 shadow-sm"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <h3 className="mb-1 font-sans text-sm font-semibold">
            Sap-to-Syrup Efficiency
          </h3>
          <p className="mb-4 text-xs text-muted">
            Lower ratio = more syrup per pound of sap
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={ratioData} layout="vertical" barSize={32}>
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => `${value}:1`}
              />
              <YAxis
                type="category"
                dataKey="season"
                tick={{ fontSize: 12, fill: "#4B5563" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`${value}:1 ratio`, ""]}
              />
              <Bar dataKey="ratio" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                {ratioData.map((entry, index) => (
                  <Cell
                    key={entry.season}
                    fill={
                      index === 0
                        ? seasonColor(seasonA.season, "#2B4A1E")
                        : seasonColor(resolvedB.season, "#F59E0B")
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="mt-4 rounded-2xl p-4"
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">🌡️</span>
            <div>
              <p className="mb-1 font-sans text-sm font-semibold">
                What affects sap flow?
              </p>
              <p className="text-xs leading-relaxed text-muted">
                Freeze-thaw cycles - nights below 28°F and days between 38-45°F - create
                pressure differentials that drive sap through the tree. Cloudy days and
                wind can reduce flow even when temperatures are ideal.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
