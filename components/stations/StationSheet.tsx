"use client";

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import LogCollectionModal from "@/components/stations/LogCollectionModal";
import { EditBucketModal, NotesList } from "@/components/stations/StationForms";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { Button, Modal, ProgressBar, Toggle } from "@/components/ui/ui";
import { stationStatusMeta } from "@/lib/selectors/stations";
import type { StationView } from "@/lib/types/schema";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-bg px-4 py-3">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-0.5 font-sans text-xl font-bold md:text-2xl">{value}</div>
    </div>
  );
}

function StationDetail({
  station,
  onClose,
  onLog,
  onEdit,
}: {
  station: StationView;
  onClose: () => void;
  onLog: () => void;
  onEdit: () => void;
}) {
  const { can } = useSession();
  const { weight } = useClubSettings();
  const { toggleMaintenance, maintenance } = useStationState();
  const meta = stationStatusMeta[station.status];
  const percent = Math.round(Math.min(station.fillPercent, 100));
  const entry = maintenance[station.bucketId];

  const chartData = station.trend.map((lbs, index) => ({ day: `Day ${index + 1}`, lbs }));

  return (
    <Modal
      title={station.name}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-3">
          {can("logCollections") ? (
            <Button onClick={onLog} className="w-full">
              Log Collection
            </Button>
          ) : null}
          <Button variant="outline" onClick={onEdit} className="w-full border-border text-text">
            Edit Station
          </Button>
        </div>
      }
    >
      <div className="-mt-2 mb-5 flex items-start justify-between gap-3">
        <p className="text-[15px] text-muted">
          {station.treeLabel} · Updated {station.lastUpdated}
        </p>
        <span className="shrink-0 font-sans text-[15px] font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Tile label="Current" value={weight(station.currentLbs, true, true)} />
        <Tile label="Target" value={weight(station.capacityLbs)} />
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[15px]">Fill</span>
          <span className="font-sans text-[15px] font-semibold">{percent}%</span>
        </div>
        <ProgressBar percent={percent} color={meta.bar} height={10} />
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Tile label="Sap age" value={`${station.sapAgeHours} h`} />
        <Tile label="Flow" value={`${station.sapFlowLph.toFixed(2)} L/h`} />
        <Tile label="Battery" value={`${Math.round(station.batteryLevel)}%`} />
      </div>

      {station.alerts.length > 0 ? (
        <div className="mb-5 space-y-2">
          {station.alerts.map((alert) => (
            <div
              key={alert.key}
              className="rounded-xl border border-attention-border bg-attention-bg px-4 py-2.5 text-sm"
            >
              <span className="font-semibold">{alert.title}.</span>{" "}
              <span className="text-muted">{alert.advice}</span>
            </div>
          ))}
        </div>
      ) : null}

      <h3 className="mb-2 font-sans text-base font-semibold">
        Fill trend, {chartData.length} day{chartData.length === 1 ? "" : "s"}
      </h3>
      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="day" hide />
            <YAxis hide domain={[0, station.capacityLbs]} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "none", background: "#1A2318", color: "#fff" }}
              formatter={(value) => [`${value} lbs`, ""]}
              labelStyle={{ color: "#B9C8B3" }}
            />
            <Line
              type="linear"
              dataKey="lbs"
              stroke="var(--color-accent-mid)"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex items-start gap-4 border-t border-border pt-5">
        <Toggle
          checked={station.inMaintenance}
          onChange={() => toggleMaintenance(station.bucketId)}
          label={`Maintenance mode for ${station.name}`}
          disabled={!can("maintenance")}
        />
        <div>
          <p className="font-sans text-base font-semibold">Maintenance mode</p>
          <p className="text-sm text-muted">
            {entry
              ? `On since ${new Date(entry.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} by ${entry.by}. Alerts for this bucket are paused.`
              : "Manager and Owner only. Pauses alerts for this bucket while you service the sensor."}
          </p>
        </div>
      </div>

      {station.notes.length > 0 ? (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="mb-2 font-sans text-base font-semibold">Notes</h3>
          <NotesList notes={station.notes} />
        </div>
      ) : null}
    </Modal>
  );
}

/**
 * Station pop-up and the flows it leads to (log a collection, edit the
 * station). Used by the Dashboard and the Stations page.
 */
export default function StationDialogs({
  bucketId,
  onClose,
}: {
  bucketId: number | null;
  onClose: () => void;
}) {
  const stations = useStationCards();
  const [mode, setMode] = useState<"detail" | "log" | "edit">("detail");
  const [shownFor, setShownFor] = useState<number | null>(bucketId);

  // A different station was opened: start again on its detail view.
  if (bucketId !== shownFor) {
    setShownFor(bucketId);
    setMode("detail");
  }

  const station = stations.find((item) => item.bucketId === bucketId);
  if (bucketId === null || !station) return null;

  if (mode === "log") {
    return <LogCollectionModal bucketId={station.bucketId} onClose={onClose} onBackToStation={() => setMode("detail")} />;
  }
  if (mode === "edit") {
    return <EditBucketModal station={station} onClose={() => setMode("detail")} />;
  }
  return (
    <StationDetail
      station={station}
      onClose={onClose}
      onLog={() => setMode("log")}
      onEdit={() => setMode("edit")}
    />
  );
}
