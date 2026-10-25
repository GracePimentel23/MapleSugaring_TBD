"use client";

import { useState } from "react";
import { useStationState } from "@/components/stations/StationStateProvider";
import { Button, Field, inputClass, Modal } from "@/components/ui/ui";
import type { StationNote, StationView } from "@/lib/types/schema";

/** A number from a form field, or undefined when it is empty or not a number. */
function numberOrUndefined(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Read-only list of notes, newest first, with who wrote each and when. */
export function NotesList({ notes }: { notes: StationNote[] }) {
  return (
    <div className="space-y-2">
      {notes.map((note, index) => (
        <div key={`${note.createdAt}-${index}`} className="rounded-xl bg-bg px-4 py-3">
          <p className="text-sm leading-relaxed">{note.text}</p>
          <p className="mt-1.5 text-xs text-muted">
            {note.author} · {note.createdAt}
          </p>
        </div>
      ))}
    </div>
  );
}

function NotesField({
  value,
  onChange,
  previous,
}: {
  value: string;
  onChange: (value: string) => void;
  previous: StationNote[];
}) {
  return (
    <div>
      <Field label="Note (optional)">
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Observations, service details…"
          className={`${inputClass} resize-none`}
        />
      </Field>
      {previous.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Previous notes</p>
          <NotesList notes={previous} />
        </div>
      ) : null}
    </div>
  );
}

export function AddStationModal({ onClose }: { onClose: () => void }) {
  const { addStation } = useStationState();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [target, setTarget] = useState("");
  const [sensorId, setSensorId] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const ok = await addStation({
      name: name.trim(),
      location: location.trim() || undefined,
      capacityLbs: numberOrUndefined(target),
      nodeCode: sensorId.trim() || undefined,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title="Add station"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Adding…" : "Add Station"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Bucket name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Bucket #06"
            className={inputClass}
          />
        </Field>
        <Field label="Tree location">
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. East Slope, tree 2"
            className={inputClass}
          />
        </Field>
        <Field label="Target weight (lbs)">
          <input
            type="number"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="25"
            className={inputClass}
          />
        </Field>
        <Field label="Sensor ID" hint="The LoRa node's ID, e.g. LC02. A node that reports on its own gets a station automatically.">
          <input
            value={sensorId}
            onChange={(event) => setSensorId(event.target.value)}
            placeholder="e.g. LC02"
            className={inputClass}
          />
        </Field>
      </div>
    </Modal>
  );
}

export function EditBucketModal({
  station,
  onClose,
}: {
  station: StationView;
  onClose: () => void;
}) {
  const { addNote, saveStation } = useStationState();
  const [name, setName] = useState(station.name);
  const [location, setLocation] = useState(station.location === "No location set" ? "" : station.location);
  const [target, setTarget] = useState(String(station.capacityLbs));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const capacityLbs = numberOrUndefined(target);
    const changes = {
      ...(name.trim() && name.trim() !== station.name ? { name: name.trim() } : {}),
      ...(location.trim() && location.trim() !== station.location ? { location: location.trim() } : {}),
      ...(capacityLbs !== undefined && capacityLbs !== station.capacityLbs ? { capacityLbs } : {}),
    };
    let ok = true;
    if (Object.keys(changes).length) ok = await saveStation(station.bucketId, changes);
    if (ok && note.trim()) ok = await addNote(station.bucketId, note.trim());
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title={`Edit ${station.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Bucket name">
          <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Tree location">
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. North Grove, tree 2"
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target weight (lbs)">
            <input type="number" value={target} onChange={(event) => setTarget(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Current weight (lbs)" hint="From the load cell.">
            <input type="number" value={station.currentLbs} disabled className={inputClass} />
          </Field>
        </div>
        <NotesField value={note} onChange={setNote} previous={station.notes} />
      </div>
    </Modal>
  );
}
