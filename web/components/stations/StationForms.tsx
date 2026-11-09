"use client";

import { useState } from "react";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { Button, cx, Field, InfoBox, inputClass, Modal } from "@/components/ui/ui";
import type { StationNote, StationView } from "@/lib/types/schema";

/** A number from a form field, or undefined when it is empty or not a number. */
function numberOrUndefined(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** "  Bucket   #06 " -> "Bucket #06": what a station name is saved as. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Why a station name cannot be used, or null if it is fine. Names must be unique (ignoring case
 * and extra spaces), retired stations included, so two buckets can never be mixed up.
 */
export function useStationNameError(name: string, exceptBucketId?: number): string | null {
  const stations = useStationCards({ includeRetired: true });
  const clean = cleanName(name);
  if (!clean) return "Give the bucket a name.";
  const taken = stations.some(
    (station) => station.bucketId !== exceptBucketId && cleanName(station.name).toLowerCase() === clean.toLowerCase(),
  );
  return taken ? `${clean} already exists. Pick a different name.` : null;
}

/** Every tree location already used by a station, A to Z. */
export function useSavedLocations(): string[] {
  const stations = useStationCards({ includeRetired: true });
  const names = new Set(
    stations.map((station) => station.location.trim()).filter((location) => location && location !== "No location set"),
  );
  return [...names].sort((a, b) => a.localeCompare(b));
}

const NEW_LOCATION = "__new__";

/**
 * Tree location: pick one of the saved locations, or add a new one (the first station at a spot).
 * Required: an empty value means nothing is picked yet.
 */
export function LocationSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const locations = useSavedLocations();
  const [adding, setAdding] = useState(locations.length === 0 || (value !== "" && !locations.includes(value)));

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. East Slope"
          className={inputClass}
          autoFocus={locations.length > 0}
        />
        {locations.length > 0 ? (
          <Button
            variant="outline"
            className="shrink-0 border-border text-text"
            onClick={() => {
              setAdding(false);
              onChange("");
            }}
          >
            Saved
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value === NEW_LOCATION) {
          setAdding(true);
          onChange("");
        } else onChange(event.target.value);
      }}
      className={cx(inputClass, !value && "text-muted")}
    >
      <option value="" disabled>
        Choose a location
      </option>
      {locations.map((location) => (
        <option key={location} value={location}>
          {location}
        </option>
      ))}
      <option value={NEW_LOCATION}>+ Add a new location…</option>
    </select>
  );
}

/** A number typed straight into an info box, with its unit beside it. */
function BoxInput({
  value,
  onChange,
  unit,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  unit: string;
  placeholder?: string;
  label: string;
}) {
  return (
    <div className="mt-0.5 flex items-baseline gap-1">
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent font-sans text-xl font-bold outline-none placeholder:text-muted/50 md:text-2xl"
      />
      <span className="text-sm font-normal text-muted md:text-base">{unit}</span>
    </div>
  );
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
  const [tried, setTried] = useState(false);
  const nameError = useStationNameError(name);
  const locationError = location.trim() ? null : "Choose where the tree is.";

  async function save() {
    setTried(true);
    if (nameError || locationError) return;
    setSaving(true);
    const ok = await addStation({
      name: cleanName(name),
      location: cleanName(location),
      capacityLbs: numberOrUndefined(target),
      nodeCode: sensorId.trim() || undefined,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title="Add Station"
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Adding…" : "Add Station"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Bucket name"
          hint={tried && nameError ? <span className="text-status-problem">{nameError}</span> : undefined}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Bucket #06"
            className={inputClass}
          />
        </Field>
        <Field
          label="Tree location"
          hint={tried && locationError ? <span className="text-status-problem">{locationError}</span> : undefined}
        >
          <LocationSelect value={location} onChange={setLocation} />
        </Field>
        <InfoBox label="Target weight" className="focus-within:ring-2 focus-within:ring-accent-mid">
          <BoxInput label="Target weight" value={target} onChange={setTarget} unit="lbs" placeholder="25" />
        </InfoBox>
        <Field
          label="Sensor ID"
          hint="The LoRa node's ID, e.g. LC02. A node that reports on its own gets a station automatically."
        >
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

export function EditBucketModal({ station, onClose }: { station: StationView; onClose: () => void }) {
  const { addNote, saveStation } = useStationState();
  const { weight, weightUnit } = useClubSettings();
  const [name, setName] = useState(station.name);
  const [tried, setTried] = useState(false);
  const [location, setLocation] = useState(station.location === "No location set" ? "" : station.location);
  const [target, setTarget] = useState(String(station.capacityLbs));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const nameError = useStationNameError(name, station.bucketId);
  const locationError = location.trim() ? null : "Choose where the tree is.";

  async function save() {
    setTried(true);
    if (nameError || locationError) return;
    setSaving(true);
    const capacityLbs = numberOrUndefined(target);
    const changes = {
      ...(cleanName(name) !== station.name ? { name: cleanName(name) } : {}),
      ...(cleanName(location) !== station.location ? { location: cleanName(location) } : {}),
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
      width="lg"
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
        <Field
          label="Bucket name"
          hint={tried && nameError ? <span className="text-status-problem">{nameError}</span> : undefined}
        >
          <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </Field>
        <Field
          label="Tree location"
          hint={tried && locationError ? <span className="text-status-problem">{locationError}</span> : undefined}
        >
          <LocationSelect value={location} onChange={setLocation} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="Current" value={weight(station.currentLbs, false, true)} unit={weightUnit} />
          <InfoBox label="Target" className="focus-within:ring-2 focus-within:ring-accent-mid">
            <BoxInput label="Target weight" value={target} onChange={setTarget} unit="lbs" />
          </InfoBox>
        </div>
        <NotesField value={note} onChange={setNote} previous={station.notes} />
      </div>
    </Modal>
  );
}
