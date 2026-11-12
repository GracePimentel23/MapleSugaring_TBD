"use client";

import { useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { AddStationModal, cleanName, LocationSelect } from "@/components/stations/StationForms";
import Select from "@/components/ui/Select";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import {
  Button,
  Card,
  CardTitle,
  Checkbox,
  ConfirmModal,
  DataTable,
  Field,
  inputClass,
  Modal,
  Toggle,
} from "@/components/ui/ui";
import type { StationView } from "@/lib/types/schema";

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
  const [treeLabel, setTreeLabel] = useState(station.location === "No location set" ? "" : station.location);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [maintenance, setMaintenance] = useState(station.inMaintenance);

  async function save() {
    if (!treeLabel.trim()) return;
    const edit = {
      ...(cleanName(treeLabel) !== station.location ? { treeLabel: cleanName(treeLabel) } : {}),
    };
    if (Object.keys(edit).length && !(await editTree(station.bucketId, edit))) return;
    if (maintenance !== station.inMaintenance) toggleMaintenance(station.bucketId);
    onClose();
  }

  return (
    <Modal title={`Edit ${station.name}`} width="lg" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Bucket">
          <input value={station.shortName} disabled className={inputClass} />
        </Field>
        <Field
          label="Tree location"
          hint={treeLabel.trim() ? undefined : <span className="text-status-problem">Choose where the tree is.</span>}
        >
          <LocationSelect value={treeLabel} onChange={setTreeLabel} />
        </Field>
        <Field
          label="Sensor ID"
          hint="The LoRa node's own ID. A new node shows up as its own station the first time it reports."
        >
          <input value={station.sensorId} disabled className={inputClass} />
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
          <Button onClick={save} disabled={!treeLabel.trim()}>
            Save Changes
          </Button>
        </div>
        <div className="border-t border-border pt-5 pb-6">
          <h3 className="font-sans text-lg font-semibold">Retire this station</h3>
          <p className="mb-4 text-sm text-muted">
            Hides it from the dashboard and keeps all its data. Delete is only offered when a station has no
            collections.
          </p>
          <Button variant="danger" onClick={() => setConfirmRetire(true)}>
            Retire Station
          </Button>
        </div>
        {confirmRetire ? (
          <ConfirmModal
            title={`Retire ${station.name}?`}
            message="It disappears from the dashboard, Stations and alerts. Its collections and history are kept."
            confirmLabel="Retire Station"
            danger
            onCancel={() => setConfirmRetire(false)}
            onConfirm={() => {
              retireTree(station.bucketId);
              setConfirmRetire(false);
              onClose();
            }}
          />
        ) : null}
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
          title="Trees and Stations"
          subtitle="Each station is one bucket on one tree, with one sensor. Retiring a station keeps its history; deleting is only possible if it has no data."
          action={
            canEditTrees ? (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                <PlusIcon size={14} />
                Add Station
              </Button>
            ) : null
          }
        />
        <DataTable
          columns={[
            { key: "bucket", label: "Bucket" },
            { key: "tree", label: "Tree" },
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
                sensor: station.sensorId,
                battery: station.batteryLevel === null ? "—" : `${Math.round(station.batteryLevel)}%`,
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
            <div className="min-w-[200px]">
              <Select
                label="Switch off automatically after"
                value={String(maintenanceDefaults.autoOffHours)}
                disabled={!canEditDefaults}
                onChange={(value) => setMaintenanceDefaults({ ...maintenanceDefaults, autoOffHours: Number(value) })}
                options={[1, 2, 4, 8].map((hours) => ({
                  value: String(hours),
                  label: `${hours} hour${hours === 1 ? "" : "s"}`,
                }))}
              />
            </div>
          </Field>
          <Field label="Warn managers before it ends">
            <div className="min-w-[200px]">
              <Select
                label="Warn managers before it ends"
                value={String(maintenanceDefaults.warnMinutes)}
                disabled={!canEditDefaults}
                onChange={(value) => setMaintenanceDefaults({ ...maintenanceDefaults, warnMinutes: Number(value) })}
                options={[15, 30, 60].map((minutes) => ({ value: String(minutes), label: `${minutes} minutes` }))}
              />
            </div>
          </Field>
          <Field label="Time to empty a bucket" hint="Weight alerts pause this long after Start Collection.">
            <div className="min-w-[200px]">
              <Select
                label="Time to empty a bucket"
                value={String(maintenanceDefaults.emptyMinutes ?? 2)}
                disabled={!canEditDefaults}
                onChange={(value) => setMaintenanceDefaults({ ...maintenanceDefaults, emptyMinutes: Number(value) })}
                options={[1, 2, 5, 10].map((minutes) => ({
                  value: String(minutes),
                  label: `${minutes} minute${minutes === 1 ? "" : "s"}`,
                }))}
              />
            </div>
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
