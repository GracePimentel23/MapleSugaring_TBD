"use client";

import { useRef, useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "@/components/icons";
import Popover from "@/components/ui/Popover";
import { Button, cx, inputClass } from "@/components/ui/ui";
import { monthDay } from "@/lib/time";

export interface DateTime {
  /** "2022-03-11" */
  date: string;
  /** Minutes after midnight, 0 to 1439 */
  minutes: number;
}

/** Minutes after midnight on the real clock (the demo keeps real time on the demo's date). */
export function nowMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** 580 -> "9:40 AM" */
export function clockLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** "Mar 11, 9:40 AM", the format collections are stored with. */
export function formatDateTime(value: DateTime): string {
  return `${monthDay(value.date)}, ${clockLabel(value.minutes)}`;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad = (value: number) => String(value).padStart(2, "0");
const isoOf = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/**
 * A date and time. The button shows the choice; the panel has a month calendar, a time field and
 * "Right now". Days after `today` can't be picked: a collection can't happen in the future.
 */
export default function DateTimePicker({
  value,
  onChange,
  today,
  label,
}: {
  value: DateTime;
  onChange: (value: DateTime) => void;
  /** The current date ("2022-03-11"); the demo's date in the demo */
  today: string;
  /** For screen readers, e.g. "When" */
  label: string;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [year, month] = value.date.split("-").map(Number) as [number, number];
  const [shown, setShown] = useState<{ year: number; month: number } | null>(null);
  // The month on screen: the chosen date's, until someone pages to another.
  const view = shown ?? { year, month: month - 1 };

  const first = new Date(Date.UTC(view.year, view.month, 1));
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const cells = [...Array<null>(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const [todayYear, todayMonth] = today.split("-").map(Number) as [number, number];
  const atLatestMonth = view.year > todayYear || (view.year === todayYear && view.month >= todayMonth - 1);

  function page(step: number) {
    const next = new Date(Date.UTC(view.year, view.month + step, 1));
    setShown({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  function close() {
    setOpen(false);
    setShown(null);
  }

  const isToday = value.date === today;

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={`${label}: ${formatDateTime(value)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={cx(inputClass, "flex items-center gap-2 text-left", open && "border-accent-mid")}
      >
        <CalendarIcon size={18} className="shrink-0 text-muted" />
        <span className="truncate">
          {isToday ? "Today" : monthDay(value.date)}, {clockLabel(value.minutes)}
        </span>
      </button>

      <Popover anchor={anchor} panelRef={panel} open={open} onClose={close} estimatedHeight={430} className="p-4">
        <div role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
          <Button
            size="sm"
            className="mb-4 w-full"
            onClick={() => {
              onChange({ date: today, minutes: nowMinutes() });
              close();
            }}
          >
            <ClockIcon size={16} />
            Right now
          </Button>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => page(-1)}
              aria-label="Previous month"
              className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-text"
            >
              <ChevronLeftIcon size={18} />
            </button>
            <span className="font-sans text-base font-semibold">
              {first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
            </span>
            <button
              type="button"
              onClick={() => page(1)}
              disabled={atLatestMonth}
              aria-label="Next month"
              className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-text disabled:opacity-30"
            >
              <ChevronRightIcon size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((name) => (
              <span key={name} className="py-1 text-xs font-semibold text-muted">
                {name}
              </span>
            ))}
            {cells.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />;
              const iso = isoOf(view.year, view.month, day);
              const selected = iso === value.date;
              const future = iso > today;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={future}
                  aria-pressed={selected}
                  aria-label={`${monthDay(iso)}${iso === today ? ", today" : ""}`}
                  onClick={() => onChange({ ...value, date: iso })}
                  className={cx(
                    "flex h-9 items-center justify-center rounded-full font-sans text-sm transition-colors disabled:cursor-not-allowed disabled:text-muted/40",
                    selected
                      ? "bg-accent font-semibold text-white"
                      : iso === today
                        ? "font-semibold text-accent ring-1 ring-accent ring-inset hover:bg-accent-light"
                        : "hover:bg-bg",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-end gap-3 border-t border-border pt-4">
            <label className="block flex-1">
              <span className="mb-1.5 block text-sm text-muted">Time</span>
              <input
                type="time"
                value={`${pad(Math.floor(value.minutes / 60))}:${pad(value.minutes % 60)}`}
                onChange={(event) => {
                  const [hours, minutes] = event.target.value.split(":").map(Number);
                  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
                    onChange({ ...value, minutes: hours! * 60 + minutes! });
                  }
                }}
                className={cx(inputClass, "py-2")}
              />
            </label>
            <Button size="sm" variant="outline" className="py-2.5" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      </Popover>
    </>
  );
}
