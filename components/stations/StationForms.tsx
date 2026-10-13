"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationState } from "@/components/stations/StationStateProvider";
import { Button, Field, inputClass, Modal } from "@/components/ui/ui";
import { noteStamp } from "@/lib/time";
import type { StationNote, StationView } from "@/lib/types/schema";

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
  const [note, setNote] = useState("");

  return (
    <Modal
      title="Add station"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Add Station</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Bucket">
          <input placeholder="e.g. #06" className={inputClass} />
        </Field>
        <Field label="Tree location">
          <input placeholder="e.g. East Slope, tree 2" className={inputClass} />
        </Field>
        <Field label="Target weight (lbs)">
          <input type="number" placeholder="12" className={inputClass} />
        </Field>
        <Field label="Sensor ID">
          <input placeholder="e.g. SN-0146" className={inputClass} />
        </Field>
        <NotesField value={note} onChange={setNote} previous={[]} />
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
  const { day } = useDemo();
  const { user } = useSession();
  const { addNote } = useStationState();
  const [note, setNote] = useState("");

  function save() {
    const text = note.trim();
    if (text) {
      addNote(station.bucketId, {
        text,
        author: user.name,
        createdAt: noteStamp(day.date),
      });
    }
    onClose();
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
          <Button onClick={save}>Save Changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tree location">
          <input defaultValue={station.treeLabel} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target weight (lbs)">
            <input type="number" defaultValue={station.capacityLbs} className={inputClass} />
          </Field>
          <Field label="Current weight (lbs)">
            <input type="number" defaultValue={station.currentLbs} className={inputClass} />
          </Field>
        </div>
        <NotesField value={note} onChange={setNote} previous={station.notes} />
      </div>
    </Modal>
  );
}
