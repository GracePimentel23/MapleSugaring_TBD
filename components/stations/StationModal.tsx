"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { cardProgressFill } from "@/lib/selectors/stations";
import type { Alert, StationDisplayStatus, StationView } from "@/lib/types/schema";
import { formatLbsNumber } from "@/lib/units";

const displayMeta: Record<StationDisplayStatus, { label: string; color: string }> = {
  complete: { label: "Complete", color: "#16A34A" },
  in_progress: { label: "In Progress", color: "#2563EB" },
  offline: { label: "Offline", color: "#DC2626" },
};

export default function StationModal({
  station,
  alerts,
  onClose,
}: {
  station: StationView;
  alerts: Alert[];
  onClose: () => void;
}) {
  const meta = displayMeta[station.displayStatus];
  const fill = cardProgressFill(station.displayStatus);

  const chartData = station.trend.map((value, index) => ({
    day: `Day ${index + 1}`,
    lbs: value,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
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
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 2C10 2 5 8 5 12a5 5 0 0010 0c0-4-5-10-5-10z" fill="#1C1C1E" />
              </svg>
              <div>
                <h2 className="font-sans text-lg font-semibold">{station.name}</h2>
                <p className="text-sm text-muted">
                  {station.location} · Updated {station.lastUpdated}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M4 4l10 10M14 4L4 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <span
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: meta.color }}
          >
            <span style={{ fontSize: 8 }}>●</span>
            {meta.label}
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
              <span className="text-sm font-semibold" style={{ color: fill }}>
                {Math.round(Math.min(station.fillPercent, 100))}%
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full"
              style={{ background: "var(--color-progress-track)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(station.fillPercent, 100)}%`, background: fill }}
              />
            </div>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            {[
              { label: "Battery", value: `${Math.round(station.batteryLevel)}%` },
              { label: "Sap Flow", value: `${station.sapFlowLph.toFixed(2)} L/h` },
              { label: "Species", value: station.treeSpecies },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-bg p-2.5">
                <div className="mb-0.5 text-xs text-muted">{item.label}</div>
                <div className="font-sans text-sm font-bold">{item.value}</div>
              </div>
            ))}
          </div>

          {alerts.length > 0 ? (
            <div className="mb-5 flex flex-col gap-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl px-3 py-2.5 text-xs"
                  style={{
                    background:
                      alert.severity === "critical"
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(245,158,11,0.1)",
                    border: `1px solid ${
                      alert.severity === "critical"
                        ? "rgba(239,68,68,0.25)"
                        : "rgba(245,158,11,0.25)"
                    }`,
                    color: alert.severity === "critical" ? "#DC2626" : "#B45309",
                  }}
                >
                  <span className="font-semibold">
                    {alert.alert_type.replace(/_/g, " ")}
                  </span>
                  {" · "}
                  {alert.message}
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <h3 className="mb-3 font-sans text-sm font-semibold">
              Fill Trend · {chartData.length} day{chartData.length === 1 ? "" : "s"}
            </h3>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="day" hide />
                  <Line
                    type="monotone"
                    dataKey="lbs"
                    stroke="#2B4A1E"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#2B4A1E" }}
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
              className="w-full rounded-xl py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-accent)" }}
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
