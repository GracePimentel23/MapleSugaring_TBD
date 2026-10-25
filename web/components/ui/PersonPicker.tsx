"use client";

import { useId, useRef, useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import Popover from "@/components/ui/Popover";
import { cx, inputClass } from "@/components/ui/ui";
import { useSession } from "@/components/session/SessionProvider";
import type { Member } from "@/lib/data/people";

function initials(name: string): string {
  return name
    .replace(/\./g, "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Pick one person from `people`. Typing filters the list by name or email; arrow keys and Enter
 * pick; leaving the field without picking puts the last choice back, so the value is always a
 * real person.
 */
export default function PersonPicker({
  people,
  value,
  onChange,
  currentUserId,
  label,
}: {
  people: Member[];
  /** The chosen person's name */
  value: string;
  onChange: (name: string) => void;
  /** Marked "you" in the list */
  currentUserId?: number;
  /** For screen readers, e.g. "Collected by" */
  label: string;
}) {
  const { viewLabels } = useSession();
  const listId = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const search = (query ?? "").trim().toLowerCase();
  const matches = search
    ? people.filter(
        (person) => person.name.toLowerCase().includes(search) || person.email.toLowerCase().includes(search),
      )
    : people;
  const active = Math.min(highlight, Math.max(matches.length - 1, 0));

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function pick(person: Member) {
    onChange(person.name);
    close();
  }

  return (
    <div ref={anchor} className="relative">
      <input
        ref={input}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        // While open the box is for searching: it starts empty with the current choice as a hint.
        placeholder={value || "Type a name"}
        value={query ?? value}
        onFocus={() => {
          setQuery("");
          setHighlight(0);
          setOpen(true);
        }}
        onClick={() => {
          if (!open) {
            setQuery("");
            setOpen(true);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onBlur={(event) => {
          // Leaving for the list itself (a click on an option) is handled by the option.
          if (panel.current?.contains(event.relatedTarget as Node)) return;
          close();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlight(Math.min(active + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight(Math.max(active - 1, 0));
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            const person = matches[active];
            if (person) pick(person);
          } else if (event.key === "Tab") {
            close();
          }
        }}
        className={cx(inputClass, "pr-10")}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Close the list" : "Show everyone"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) close();
          else {
            setQuery("");
            setOpen(true);
            input.current?.focus();
          }
        }}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-bg"
      >
        <ChevronDownIcon size={18} />
      </button>

      <Popover
        anchor={anchor}
        panelRef={panel}
        open={open}
        onClose={close}
        matchWidth
        estimatedHeight={280}
        className="overflow-hidden py-1"
      >
        <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto overscroll-contain">
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No one with access matches &ldquo;{query}&rdquo;.</li>
          ) : (
            matches.map((person, index) => {
              const selected = person.name === value;
              return (
                <li
                  key={person.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pick(person)}
                  className={cx("flex cursor-pointer items-center gap-3 px-3 py-2", index === active ? "bg-bg" : "")}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-mid font-sans text-xs font-bold text-white">
                    {initials(person.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-body font-semibold">
                      {person.name}
                      {person.id === currentUserId ? <span className="font-normal text-muted"> (you)</span> : null}
                    </span>
                    <span className="block truncate text-sm text-muted">{viewLabels[person.role] ?? person.role}</span>
                  </span>
                  {selected ? <span className="text-sm font-semibold text-accent-mid">Selected</span> : null}
                </li>
              );
            })
          )}
        </ul>
      </Popover>
    </div>
  );
}
