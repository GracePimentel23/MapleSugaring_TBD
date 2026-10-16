"use client";

import { useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { AddStationModal } from "@/components/stations/StationForms";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { Button, Card, CardTitle, Checkbox, DataTable, Field, inputClass, Modal, Toggle } from "@/components/ui/ui";
import type { StationView } from "@/lib/types/schema";

const species = ["Sugar Maple", "Red Maple", "Black Maple", "Silver Maple", "Norway Maple"];

function treeStatus(station: StationView): { label: string; color: string } {
  if (station.inMaintenance) return { label: "Maintenance", color: "var(--color-status-maintenance)" };
  if (station.isOffline) return { label: "No signal", color: "var(--color-status-problem)" };
  if (station.alerts.some((alert) => alert.kind === "battery")) {
    return { label: "Low battery", color: "var(--color-status-problem)" };
  }
  return { label: "Active", color: "var(--color-text)" };
}

function EditTreeModal({ station, onClose }: { station: StationView; onClose: () => void }) {
  const { can } = useSession();
  const { maintenanceDefaults } = useClubSettings();
  const { editTree, retireTree, toggleMaintenance } = useStationState();
  const [treeLabel, setTreeLabel] = useState(station.treeLabel);
  const [treeSpecies, setTreeSpecies] = useState(station.treeSpecies);
  const [sensorId, setSensorId] = useState(station.sensorId);
  const [maintenance, setMaintenance] = useState(station.inMaintenance);

  function save() {
    const edit = {
      ...(treeLabel !== station.treeLabel ? { treeLabel } : {}),
      ...(treeSpecies !== station.treeSpecies ? { treeSpecies } : {}),
      ...(sensorId !== station.sensorId ? { sensorId } : {}),
    };
    if (Object.keys(edit).length) editTree(station.bucketId, edit);
    if (maintenance !== station.inMaintenance) toggleMaintenance(station.bucketId);
    onClose();
  }

  return (
    <Modal title="Edit tree and sensor" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Bucket">
          <input value={station.shortName} disabled className={inputClass} />
        </Field>
        <Field label="Tree location">
          <input value={treeLabel} onChange={(event) => setTreeLabel(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Species">
          <select value={treeSpecies} onChange={(event) => setTreeSpecies(event.target.value)} className={inputClass}>
            {species.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sensor ID" hint="Replacing a sensor? Enter the new ID; history stays with the tree.">
          <input value={sensorId} onChange={(event) => setSensorId(event.target.value)} className={inputClass} />
        </Field>
        <div className="flex items-start gap-4 pt-1">
          <Toggle
            checked={maintenance}
            onChange={setMaintenance}
            label="Maintenance mode"
            disabled={!can("stations:maintenance")}
          />
          <div>
            <p className="font-sans text-base font-semibold">Maintenance mode</p>
            <p className="text-sm text-muted">
              Pauses alerts. Switches off after {maintenanceDefaults.autoOffHours} hours.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save Changes</Button>
        </div>
        <div className="border-t border-border pt-5 pb-6">
          <h3 className="font-sans text-lg font-semibold">Retire this tree</h3>
          <p className="mb-4 text-sm text-muted">
            Hides it from the dashboard and keeps all its data. Delete is only offered when a tree
            has no collections.
          </p>
          <Button
            variant="danger"
            onClick={() => {
              retireTree(station.bucketId);
              onClose();
            }}
          >
            Retire Tree
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function TreesTab() {
  const stations = useStationCards();
  const { can } = useSession();
  const { maintenanceDefaults, setMaintenanceDefaults } = useClubSettings();
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const canEditTrees = can("stations:manage");
  // The defaults are set by the Owner / IT; managers switch maintenance per bucket.
  const canEditDefaults = can("thresholds:manage");
  const editingStation = stations.find((station) => station.bucketId === editing) ?? null;

  return (
    <>
      <Card className="md:px-8 md:py-7">
        <CardTitle
          title="Trees and Sensors"
          subtitle="Each bucket has one tree and one sensor. Retiring a tree keeps its history; deleting is only possible if it has no data."
          action={
            canEditTrees ? (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                <PlusIcon size={14} />
                Add Tree
              </Button>
            ) : null
          }
        />
        <DataTable
          columns={[
            { key: "bucket", label: "Bucket" },
            { key: "tree", label: "Tree" },
            { key: "species", label: "Species" },
            { key: "sensor", label: "Sensor ID" },
            { key: "battery", label: "Battery" },
            { key: "seen", label: "Last seen" },
            { key: "status", label: "Status" },
            { key: "go", label: "" },
          ]}
          rows={stations.map((station) => {
            const status = treeStatus(station);
            return {
              key: String(station.bucketId),
              onClick: canEditTrees ? () => setEditing(station.bucketId) : undefined,
              cells: {
                bucket: station.shortName,
                tree: station.treeLabel,
                species: station.treeSpecies,
                sensor: station.sensorId,
                battery: `${Math.round(station.batteryLevel)}%`,
                seen: station.lastUpdated,
                status: (
                  <span className="font-semibold" style={{ color: status.color }}>
                    {status.label}
                  </span>
                ),
                go: canEditTrees ? <ChevronRightIcon size={18} /> : null,
              },
            };
          })}
        />
      </Card>

      <Card className="md:px-8 md:py-7">
        <CardTitle
          title="Maintenance Mode"
          subtitle="Pauses alerts for one bucket while its sensor is serviced, so a battery swap does not trigger a false alarm. Managers turn it on per bucket; the defaults below are set by the Owner / IT."
        />
        <div className="flex flex-wrap gap-4">
          <Field label="Switch off automatically after">
            <select
              value={maintenanceDefaults.autoOffHours}
              disabled={!canEditDefaults}
              onChange={(event) =>
                setMaintenanceDefaults({ ...maintenanceDefaults, autoOffHours: Number(event.target.value) })
              }
              className={`${inputClass} min-w-[200px]`}
            >
              {[1, 2, 4, 8].map((hours) => (
                <option key={hours} value={hours}>
                  {hours} hour{hours === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Warn managers before it ends">
            <select
              value={maintenanceDefaults.warnMinutes}
              disabled={!canEditDefaults}
              onChange={(event) =>
                setMaintenanceDefaults({ ...maintenanceDefaults, warnMinutes: Number(event.target.value) })
              }
              className={`${inputClass} min-w-[200px]`}
            >
              {[15, 30, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5">
          <Checkbox
            label="Let managers extend it by 1 hour from the reminder"
            checked={maintenanceDefaults.allowExtend}
            disabled={!canEditDefaults}
            onChange={(checked) => setMaintenanceDefaults({ ...maintenanceDefaults, allowExtend: checked })}
          />
        </div>
        <p className="mt-4 text-sm text-muted">
          If it switches off with a sensor still silent, the normal sensor alert fires.
        </p>
      </Card>

      {editingStation ? <EditTreeModal station={editingStation} onClose={() => setEditing(null)} /> : null}
      {adding ? <AddStationModal onClose={() => setAdding(false)} /> : null}
    </>
  );
}
