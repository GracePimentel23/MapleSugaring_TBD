"use client";

import { useState, type ReactNode } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { useStationState } from "@/components/stations/StationStateProvider";
import { currentUser, formatNoteTimestamp } from "@/lib/data/stationNotes";
import type { StationNote, StationView } from "@/lib/types/schema";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Read-only list of a bucket's notes, newest first. */
export function NotesList({ notes }: { notes: StationNote[] }) {
  return (
    <div className="space-y-2">
      {notes.map((note, index) => (
        <div key={`${note.createdAt}-${index}`} className="rounded-xl bg-bg px-3 py-2.5">
          <p className="text-sm leading-relaxed">{note.text}</p>
          <p className="mt-1.5 text-[11px] text-muted">
            {note.author} · {note.createdAt}
          </p>
        </div>
      ))}
    </div>
  );
}

function ModalFrame({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:max-w-md md:rounded-2xl"
        style={{ maxHeight: "92vh" }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-4">
          <h3 className="font-sans text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5">{children}</div>
        <div className="mt-4 flex shrink-0 gap-2 px-5 pb-5">{footer}</div>
      </div>
    </div>
  );
}

function TextField({
  label,
  type = "text",
  defaultValue,
  placeholder,
}: {
  label: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "var(--color-border)" }}
      />
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
      <label className="mb-1 block text-xs font-medium text-muted">Notes</label>
      <textarea
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Observations, service details…"
        className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "var(--color-border)" }}
      />
      {previous.length > 0 ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold">Previous notes</p>
          <NotesList notes={previous} />
        </div>
      ) : null}
    </div>
  );
}

function FooterButtons({
  onCancel,
  onSave,
  saveLabel,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-xl border py-2.5 font-sans text-sm font-semibold"
        style={{ borderColor: "var(--color-border)" }}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        className="flex-1 rounded-xl py-2.5 font-sans text-sm font-semibold text-white"
        style={{ background: "var(--color-accent)" }}
      >
        {saveLabel}
      </button>
    </>
  );
}

export function AddStationModal({ onClose }: { onClose: () => void }) {
  const [note, setNote] = useState("");

  return (
    <ModalFrame
      title="Add Station"
      onClose={onClose}
      footer={<FooterButtons onCancel={onClose} onSave={onClose} saveLabel="Add Station" />}
    >
      <TextField label="Bucket Name" placeholder="e.g. Bucket #06" />
      <TextField label="Location" placeholder="e.g. East Slope" />
      <TextField label="Target Weight (lbs)" type="number" placeholder="12" />
      <NotesField value={note} onChange={setNote} previous={[]} />
    </ModalFrame>
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
  const { addNote } = useStationState();
  const [note, setNote] = useState("");

  function save() {
    const text = note.trim();
    if (text) {
      addNote(station.bucketId, {
        text,
        author: currentUser.name,
        createdAt: formatNoteTimestamp(day.date, new Date()),
      });
    }
    onClose();
  }

  return (
    <ModalFrame
      title={`Edit ${station.name}`}
      onClose={onClose}
      footer={<FooterButtons onCancel={onClose} onSave={save} saveLabel="Save Changes" />}
    >
      <TextField label="Bucket Name" defaultValue={station.name} />
      <TextField label="Location" defaultValue={station.location} />
      <TextField label="Target Weight (lbs)" type="number" defaultValue={station.capacityLbs} />
      <TextField label="Current Weight (lbs)" type="number" defaultValue={station.currentLbs} />
      <NotesField value={note} onChange={setNote} previous={station.notes} />
    </ModalFrame>
  );
}
