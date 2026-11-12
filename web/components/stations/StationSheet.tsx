"use client";

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import LogCollectionModal from "@/components/stations/LogCollectionModal";
import { EditBucketModal, NotesList } from "@/components/stations/StationForms";
import StatusBadge from "@/components/stations/StatusBadge";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { lineCursor, tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from "@/components/ui/chartTheme";
import { Button, ChartEmpty, InfoBox, Modal, ProgressBar, Toggle } from "@/components/ui/ui";
import { stationStatusMeta } from "@/lib/selectors/stations";
import type { StationView } from "@/lib/types/schema";

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
  const { can, shows } = useSession();
  const { weight, animations } = useClubSettings();
  const { toggleMaintenance, maintenance } = useStationState();
  const meta = stationStatusMeta[station.status];
  const percent = Math.round(Math.min(station.fillPercent, 100));
  const entry = maintenance[station.bucketId];
  const showAlerts = station.alerts.length > 0 && shows("stations.alerts");

  const chartData = station.trend.map((lbs, index) => ({ day: `Day ${index + 1}`, lbs }));

  return (
    <Modal
      title={station.name}
      width="lg"
      subtitle={`${station.treeLabel} · Updated ${station.lastUpdated}`}
      badge={<StatusBadge status={station.status} />}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-3">
          {can("collections:log") ? (
            <Button onClick={onLog} className="w-full">
              Log Collection
            </Button>
          ) : null}
          {shows("stations.manage") ? (
            <Button variant="outline" onClick={onEdit} className="w-full border-border text-text">
              Edit Station
            </Button>
          ) : null}
        </div>
      }
    >
      {/* What each alert means, at the top in plain words; the red boxes below just name them. */}
      {showAlerts ? (
        <div className="mb-4 space-y-1">
          {station.alerts.map((alert) => (
            <p key={alert.key} className="text-body text-muted">
              {alert.advice.replace(`${station.location}. `, "")}
            </p>
          ))}
        </div>
      ) : null}

      {/* The same read as the station card: current out of target, then the level. */}
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span>
            <span className="font-sans text-3xl font-bold">{weight(station.currentLbs, false, true)}</span>
            <span className="ml-1.5 text-sm text-muted">/ {weight(station.capacityLbs)}</span>
          </span>
          <span className="font-sans text-body font-semibold">{percent}%</span>
        </div>
        <ProgressBar percent={percent} color={meta.bar} height={10} filling />
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <InfoBox label="Sap age" value={station.sapAgeHours} unit="h" />
        <InfoBox label="Flow" value={station.sapFlowLph.toFixed(2)} unit="L/h" />
        <InfoBox
          label="Battery"
          value={station.batteryLevel === null ? "—" : Math.round(station.batteryLevel)}
          unit={station.batteryLevel === null ? undefined : "%"}
        />
      </div>

      {showAlerts ? (
        <div className="mb-5 space-y-2">
          {station.alerts.map((alert) => (
            <div
              key={alert.key}
              className="rounded-xl border border-attention-border bg-attention-bg px-4 py-2.5 text-sm font-semibold"
            >
              {alert.title}
            </div>
          ))}
        </div>
      ) : null}

      <h3 className="mb-2 font-sans text-base font-semibold">
        Fill trend, {chartData.length} day{chartData.length === 1 ? "" : "s"}
      </h3>
      {chartData.length < 2 ? (
        <ChartEmpty height={110} />
      ) : (
        <div className="h-[110px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={[0, station.capacityLbs]} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={lineCursor}
                formatter={(value) => [`${value} lbs`, "Fill"]}
              />
              <Line
                type="linear"
                dataKey="lbs"
                stroke="var(--color-accent-mid)"
                strokeWidth={3}
                dot={false}
                isAnimationActive={animations}
                animationDuration={900}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {can("stations:maintenance") ? (
        <div className="mt-5 flex items-start gap-4 border-t border-border pt-5">
          <Toggle
            checked={station.inMaintenance}
            onChange={() => toggleMaintenance(station.bucketId)}
            label={`Maintenance mode for ${station.name}`}
            disabled={!can("stations:maintenance")}
          />
          <div>
            <p className="font-sans text-base font-semibold">Maintenance mode</p>
            <p className="text-sm text-muted">
              {entry
                ? `On until ${new Date(entry.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Alerts for this bucket are paused.`
                : "Manager and Owner only. Pauses alerts for this bucket while you service the sensor."}
            </p>
          </div>
        </div>
      ) : null}

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
export default function StationDialogs({ bucketId, onClose }: { bucketId: number | null; onClose: () => void }) {
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
    return <LogCollectionModal bucketId={station.bucketId} onClose={onClose} />;
  }
  if (mode === "edit") {
    return <EditBucketModal station={station} onClose={() => setMode("detail")} />;
  }
  return (
    <StationDetail station={station} onClose={onClose} onLog={() => setMode("log")} onEdit={() => setMode("edit")} />
  );
}
