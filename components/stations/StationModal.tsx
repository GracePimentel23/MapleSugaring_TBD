"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { DropletIcon } from "@/components/icons";
import { formatLbsNumber } from "@/lib/units";
import type { StationUiStatus, StationView } from "@/lib/types/schema";

const statusColor: Record<StationUiStatus, string> = {
  online: "var(--color-status-online)",
  attention: "var(--color-status-attention)",
  offline: "var(--color-status-offline)",
};

const statusLabel: Record<StationUiStatus, string> = {
  online: "Complete",
  attention: "Needs Attention",
  offline: "Offline",
};

const statusBg: Record<StationUiStatus, string> = {
  online: "rgba(34,197,94,0.1)",
  attention: "rgba(245,158,11,0.1)",
  offline: "rgba(239,68,68,0.1)",
};

const progressColor: Record<StationUiStatus, string> = {
  online: "var(--color-accent)",
  attention: "var(--color-status-attention)",
  offline: "var(--color-status-offline)",
};

const trendDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function StationModal({
  station,
  onClose,
}: {
  station: StationView;
  onClose: () => void;
}) {
  const chartData = station.trend.map((value, index) => ({
    day: trendDays[index] ?? `D${index + 1}`,
    lbs: value,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close station details"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl md:max-w-md md:rounded-2xl"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-light">
                <DropletIcon fill="var(--color-accent)" size={22} />
              </div>
              <div>
                <h2 className="font-sans text-lg font-semibold">{station.name}</h2>
                <p className="text-sm text-muted">{station.treeSpecies}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <span
            className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
            style={{ color: statusColor[station.status], background: statusBg[station.status] }}
          >
            <span className="text-[8px]">●</span>
            {statusLabel[station.status]}
          </span>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-bg p-3">
              <div className="mb-1 text-xs text-muted">Current Weight</div>
              <div className="font-sans text-xl font-bold">
                {formatLbsNumber(station.currentLbs)} lbs
              </div>
            </div>
            <div className="rounded-xl bg-bg p-3">
              <div className="mb-1 text-xs text-muted">Target Weight</div>
              <div className="font-sans text-xl font-bold">
                {formatLbsNumber(station.capacityLbs)} lbs
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-2 flex justify-between">
              <span className="font-sans text-sm font-medium">Fill Progress</span>
              <span className="text-sm font-semibold" style={{ color: progressColor[station.status] }}>
                {Math.round(station.fillPercent)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-progress-track">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(station.fillPercent, 100)}%`,
                  background: progressColor[station.status],
                }}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-sans text-sm font-semibold">7-Day Trend</h3>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="day" hide />
                  <Line
                    type="monotone"
                    dataKey="lbs"
                    stroke="#4D7C30"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#4D7C30" }}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      padding: "4px 10px",
                      border: "none",
                      borderRadius: 8,
                      background: "#1C1C1E",
                      color: "#fff",
                    }}
                    formatter={(value) => [`${value} lbs`, ""]}
                    labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-xl bg-accent py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Log Collection
            </button>
            <button
              type="button"
              className="w-full rounded-xl py-2.5 font-sans text-sm font-semibold text-text transition-colors"
              style={{ border: "1.5px solid var(--color-border)" }}
            >
              Edit Station
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
