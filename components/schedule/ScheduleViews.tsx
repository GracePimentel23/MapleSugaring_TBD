"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import { typeColor } from "@/components/schedule/TaskCard";
import { useStationCards } from "@/components/stations/StationStateProvider";
import { Card, cx } from "@/components/ui/ui";
import { taskStatus, taskTypeLabel, timeSlots, type ScheduleTask } from "@/lib/data/schedule";
import StatusBadge from "@/components/stations/StatusBadge";
import type { StationStatus } from "@/lib/types/schema";
import { demoWeather } from "@/lib/demo/weather";
import { monthDay, weekdayName } from "@/lib/time";

const slotOrder = Object.fromEntries(timeSlots.map((slot, index) => [slot.id, index]));
const slotShort: Record<string, string> = {
  morning: "AM",
  midday: "Noon",
  afternoon: "PM",
  evening: "Eve",
};

function bySlot(a: ScheduleTask, b: ScheduleTask) {
  return slotOrder[a.slot]! - slotOrder[b.slot]!;
}

function treeTag(task: ScheduleTask): string {
  return task.bucketId === null ? "Grove" : `#${String(task.bucketId).padStart(2, "0")}`;
}

/** One job as a small colored pill, for the calendar grids. */
function TaskChip({ task, onOpen, showTree }: { task: ScheduleTask; onOpen: () => void; showTree: boolean }) {
  const { dayIndex } = useDemo();
  const status = taskStatus(task, dayIndex);
  const color = typeColor[task.type];
  const needsPeople = status === "open" || status === "partial";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      title={task.title}
      className={cx(
        "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight font-semibold transition-opacity hover:opacity-80",
        status === "done" && "line-through opacity-50",
        status === "missed" && "opacity-60",
      )}
      style={{ color: color.fg, background: color.bg }}
    >
      {needsPeople ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-attention" /> : null}
      <span className="truncate">
        {showTree ? `${treeTag(task)} · ` : `${slotShort[task.slot]} · `}
        {taskTypeLabel[task.type]}
      </span>
    </button>
  );
}

/** Month grid for the season. Days outside the demo window are greyed out. */
export function CalendarView({
  tasks,
  selectedDay,
  onSelectDay,
  onOpenTask,
}: {
  tasks: ScheduleTask[];
  selectedDay: number;
  onSelectDay: (dayIndex: number) => void;
  onOpenTask: (task: ScheduleTask) => void;
}) {
  const { dayIndex } = useDemo();
  const [year, month] = demoWeather[0]!.date.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: cellCount }, (_, cell) => {
    const date = new Date(Date.UTC(year, month - 1, cell - leading + 1));
    const iso = date.toISOString().slice(0, 10);
    return {
      iso,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
      index: demoWeather.findIndex((item) => item.date === iso),
    };
  });

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="font-sans text-lg font-semibold">
          {first.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </h3>
        <span className="text-xs text-muted">Season runs Mar 1–14</span>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-bg/60 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
          <div key={name} className="table-head py-2">
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const inSeason = cell.index >= 0;
          const dayTasks = inSeason ? tasks.filter((task) => task.dayIndex === cell.index).sort(bySlot) : [];
          const selected = cell.index === selectedDay;
          const today = cell.index === dayIndex;
          const shown = dayTasks.slice(0, 3);

          return (
            <div
              key={cell.iso}
              role={inSeason ? "button" : undefined}
              tabIndex={inSeason ? 0 : undefined}
              onClick={() => inSeason && onSelectDay(cell.index)}
              onKeyDown={(event) => {
                if (inSeason && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelectDay(cell.index);
                }
              }}
              aria-label={inSeason ? `${monthDay(cell.iso)}, ${dayTasks.length} jobs` : undefined}
              className={cx(
                "min-h-[72px] border-r border-b border-border p-1.5 last:border-r-0 md:min-h-[112px] md:p-2 [&:nth-child(7n)]:border-r-0",
                inSeason ? "cursor-pointer bg-white hover:bg-bg/60" : "bg-bg/50",
                selected && "relative z-10 ring-2 ring-accent-mid ring-inset",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cx(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-sans text-sm",
                    today ? "bg-accent font-bold text-white" : cell.inMonth ? "text-text" : "text-muted/50",
                    !inSeason && cell.inMonth && "text-muted/60",
                  )}
                >
                  {cell.day}
                </span>
                {today ? (
                  <span className="hidden text-[10px] font-semibold text-accent-mid md:inline">Today</span>
                ) : null}
              </div>

              {/* Phones get a count; wider screens list the jobs. */}
              {dayTasks.length ? (
                <span className="text-[10px] font-semibold text-muted md:hidden">{dayTasks.length} jobs</span>
              ) : null}
              <div className="hidden space-y-1 md:block">
                {shown.map((task) => (
                  <TaskChip key={task.id} task={task} showTree onOpen={() => onOpenTask(task)} />
                ))}
                {dayTasks.length > shown.length ? (
                  <span className="block px-1 text-[11px] font-semibold text-muted">
                    +{dayTasks.length - shown.length} more
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Trees down the side, days across the top: who is doing what, where. */
export function TreeGridView({
  tasks,
  selectedDay,
  onSelectDay,
  onOpenTask,
  onAdd,
}: {
  tasks: ScheduleTask[];
  selectedDay: number;
  onSelectDay: (dayIndex: number) => void;
  onOpenTask: (task: ScheduleTask) => void;
  onAdd: (bucketId: number | null, dayIndex: number) => void;
}) {
  const { dayIndex } = useDemo();
  const stations = useStationCards();
  // Follows the selected day until someone pages to another week.
  const [pickedWeek, setWeekStart] = useState<number | null>(null);
  const weekStart = pickedWeek ?? Math.floor(selectedDay / 7) * 7;
  const days = demoWeather.slice(weekStart, weekStart + 7).map((item, offset) => ({
    ...item,
    index: weekStart + offset,
  }));
  const rows: {
    bucketId: number | null;
    title: string;
    subtitle: string;
    status?: StationStatus;
  }[] = [
    ...stations.map((station) => ({
      bucketId: station.bucketId,
      title: station.name,
      subtitle: station.treeLabel,
      status: station.status,
    })),
    {
      bucketId: null,
      title: "Grove & shed",
      subtitle: "Evaporator, cleaning, storm prep",
    },
  ];

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="font-sans text-lg font-semibold">
          {monthDay(days[0]!.date)} – {monthDay(days[days.length - 1]!.date)}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setWeekStart(Math.max(weekStart - 7, 0))}
            disabled={weekStart === 0}
            aria-label="Previous week"
            className="rounded-lg p-1.5 hover:bg-bg disabled:opacity-30"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(Math.min(weekStart + 7, Math.floor((demoWeather.length - 1) / 7) * 7))}
            disabled={weekStart + 7 >= demoWeather.length}
            aria-label="Next week"
            className="rounded-lg p-1.5 hover:bg-bg disabled:opacity-30"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="table-head w-[180px] px-4 py-2.5">Tree</th>
              {days.map((day) => (
                <th key={day.date} className="px-1.5 py-2">
                  <button
                    type="button"
                    onClick={() => onSelectDay(day.index)}
                    className={cx(
                      "w-full rounded-lg py-1 text-center font-sans",
                      day.index === selectedDay ? "bg-accent text-white" : "hover:bg-bg",
                    )}
                  >
                    <span className="block text-[11px] font-semibold uppercase">
                      {day.index === dayIndex ? "Today" : weekdayName(day.date, "short")}
                    </span>
                    <span className="block text-base font-bold">{Number(day.date.slice(-2))}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.bucketId ?? "grove"} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-3 align-top font-normal">
                  <span className="block font-sans text-sm font-semibold">{row.title}</span>
                  <span className="block text-xs text-muted">{row.subtitle}</span>
                  {row.status ? <StatusBadge status={row.status} size="sm" className="mt-1" /> : null}
                </th>
                {days.map((day) => {
                  const cellTasks = tasks
                    .filter((task) => task.dayIndex === day.index && task.bucketId === row.bucketId)
                    .sort(bySlot);
                  const canAdd = day.index >= dayIndex;
                  return (
                    <td
                      key={day.date}
                      className={cx(
                        "group relative h-[76px] border-l border-border px-1.5 py-1.5 align-top",
                        day.index === selectedDay && "bg-accent-light/40",
                        day.index < dayIndex && "bg-bg/50",
                      )}
                    >
                      <div className="space-y-1">
                        {cellTasks.map((task) => (
                          <TaskChip key={task.id} task={task} showTree={false} onOpen={() => onOpenTask(task)} />
                        ))}
                      </div>
                      {canAdd ? (
                        <button
                          type="button"
                          onClick={() => onAdd(row.bucketId, day.index)}
                          aria-label={`Add a job for ${row.title} on ${monthDay(day.date)}`}
                          className="absolute right-1 bottom-1 rounded-md p-0.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bg focus-visible:opacity-100"
                        >
                          <PlusIcon size={14} />
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** A week of days to tap between, with a dot on days that still need people. */
export function WeekStrip({
  tasks,
  selectedDay,
  onSelectDay,
}: {
  tasks: ScheduleTask[];
  selectedDay: number;
  onSelectDay: (dayIndex: number) => void;
}) {
  const { dayIndex } = useDemo();
  const weekStart = Math.floor(selectedDay / 7) * 7;
  const lastWeek = Math.floor((demoWeather.length - 1) / 7) * 7;
  const days = demoWeather.slice(weekStart, weekStart + 7).map((item, offset) => ({
    ...item,
    index: weekStart + offset,
  }));

  return (
    <div className="flex items-center gap-1 md:gap-2">
      <button
        type="button"
        onClick={() => onSelectDay(Math.max(weekStart - 7, 0))}
        disabled={weekStart === 0}
        aria-label="Previous week"
        className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-white hover:text-text disabled:opacity-30"
      >
        <ChevronLeftIcon size={20} />
      </button>
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1 md:gap-2">
        {days.map((day) => {
          const dayTasks = tasks.filter((task) => task.dayIndex === day.index);
          const needsPeople = dayTasks.some((task) => ["open", "partial"].includes(taskStatus(task, dayIndex)));
          const selected = day.index === selectedDay;
          const today = day.index === dayIndex;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDay(day.index)}
              aria-pressed={selected}
              aria-label={`${weekdayName(day.date)}, ${monthDay(day.date)}: ${dayTasks.length} job${dayTasks.length === 1 ? "" : "s"}${needsPeople ? ", needs people" : ""}`}
              className={cx(
                "flex flex-col items-center rounded-2xl py-2 font-sans transition-colors md:py-3",
                selected ? "bg-accent text-white shadow-sm" : "bg-white hover:bg-accent-light",
                today && !selected && "ring-2 ring-accent-mid ring-inset",
              )}
            >
              <span
                className={cx(
                  "text-[11px] font-semibold uppercase md:text-xs",
                  selected ? "text-white/80" : "text-muted",
                )}
              >
                {today ? "Today" : weekdayName(day.date, "short")}
              </span>
              <span className="text-lg leading-tight font-bold md:text-2xl">{Number(day.date.slice(-2))}</span>
              <span className="mt-1 flex h-1.5 items-center gap-0.5">
                {needsPeople ? (
                  <span className={cx("h-1.5 w-1.5 rounded-full", selected ? "bg-white" : "bg-status-attention")} />
                ) : dayTasks.length ? (
                  <span className={cx("h-1.5 w-1.5 rounded-full", selected ? "bg-white/60" : "bg-[#C8CCC2]")} />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelectDay(Math.min(weekStart + 7, lastWeek))}
        disabled={weekStart >= lastWeek}
        aria-label="Next week"
        className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-white hover:text-text disabled:opacity-30"
      >
        <ChevronRightIcon size={20} />
      </button>
    </div>
  );
}
