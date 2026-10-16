"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { CheckIcon, MoreIcon } from "@/components/icons";
import { useSchedule } from "@/components/schedule/ScheduleProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationCards } from "@/components/stations/StationStateProvider";
import { Button, cx } from "@/components/ui/ui";
import { taskStatus, taskTypeLabel, type ScheduleTask, type TaskStatus, type TaskType } from "@/lib/data/schedule";
import type { Member } from "@/lib/data/people";

export const typeColor: Record<TaskType, { fg: string; bg: string }> = {
  collect: { fg: "#7A5300", bg: "#FBF1D6" },
  battery: {
    fg: "var(--color-status-problem)",
    bg: "var(--color-attention-bg)",
  },
  sensor: {
    fg: "var(--color-status-problem)",
    bg: "var(--color-attention-bg)",
  },
  evaporator: {
    fg: "var(--color-accent-mid)",
    bg: "var(--color-accent-light)",
  },
  bottling: { fg: "var(--color-accent-mid)", bg: "var(--color-accent-light)" },
  tapping: { fg: "var(--color-accent-mid)", bg: "var(--color-accent-light)" },
  cleaning: { fg: "var(--color-slate)", bg: "var(--color-weather-bg)" },
  weather: { fg: "var(--color-slate)", bg: "var(--color-weather-bg)" },
  other: { fg: "var(--color-muted)", bg: "#ECECE6" },
};

function initials(name: string): string {
  return name
    .replace(/\./g, "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({ member }: { member: Member }) {
  return (
    <span
      title={member.name}
      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-accent-mid font-sans text-xs font-bold text-white"
    >
      {initials(member.name)}
    </span>
  );
}

/** Sign-ups are never capped: "people needed" is a goal, not a limit. */
export function statusText(task: ScheduleTask, status: TaskStatus): { text: string; color: string } {
  const signed = task.assigneeIds.length;
  const missing = task.spots - signed;
  if (status === "done")
    return {
      text: task.doneBy ? `Done by ${task.doneBy}` : "Done",
      color: "var(--color-status-online)",
    };
  if (status === "missed") return { text: "Not done", color: "var(--color-status-problem)" };
  if (status === "filled") return { text: `${signed} signed up`, color: "var(--color-status-online)" };
  if (signed === 0)
    return {
      text: `Needs ${task.spots} ${task.spots === 1 ? "person" : "people"}`,
      color: "var(--color-status-due)",
    };
  return { text: `Needs ${missing} more`, color: "var(--color-status-due)" };
}

/** A label for the tree a task is at, or the grove as a whole. */
export function useTreeLabel() {
  const stations = useStationCards({ includeRetired: true });
  return (bucketId: number | null) => {
    if (bucketId === null) return "Grove & shed";
    const station = stations.find((item) => item.bucketId === bucketId);
    return station ? `${station.shortName} · ${station.treeLabel}` : "Grove & shed";
  };
}

interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** The "⋯" button: the less common actions live here so each job shows one button. */
function MoreMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={(event) => {
          // Open upward near the bottom of the screen, clear of the phone tab bar.
          setUp(window.innerHeight - event.currentTarget.getBoundingClientRect().bottom < 260);
          setOpen((value) => !value);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More options for ${label}`}
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bg hover:text-text"
      >
        <MoreIcon size={20} />
      </button>
      {open ? (
        <div
          role="menu"
          className={cx(
            "absolute right-0 z-30 w-44 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg",
            up ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cx(
                "block w-full px-4 py-2 text-left font-sans text-sm hover:bg-bg",
                item.danger ? "text-status-problem" : "text-text",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One job on the schedule: what, where, who, and the one thing you would do
 * next (sign up, finish it). Everything else is in the "⋯" menu.
 */
export default function TaskCard({
  task,
  onAssign,
  onLog,
}: {
  task: ScheduleTask;
  onAssign: () => void;
  onLog: () => void;
}) {
  const { dayIndex } = useDemo();
  const { user, members, can } = useSession();
  const { claim, unassign, complete, reopen, removeTask } = useSchedule();
  const treeLabel = useTreeLabel();
  const status = taskStatus(task, dayIndex);
  const label = statusText(task, status);
  const assignees = task.assigneeIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Member => Boolean(member));
  const mine = task.assigneeIds.includes(user.id);
  const manage = can("schedule:manage");
  const join = can("schedule:join");
  const upcoming = task.dayIndex >= dayIndex;
  const open = status !== "done" && status !== "missed";
  const canFinish = ((mine && join) || manage) && task.dayIndex <= dayIndex && status !== "done";
  const finishLabel = task.type === "collect" && task.bucketId !== null ? "Log & Finish" : "Mark Done";
  const finish = () => (task.type === "collect" && task.bucketId !== null ? onLog() : complete(task.id));
  const color = typeColor[task.type];
  const stillNeeded = Math.max(task.spots - assignees.length, 0);

  // The one button a job shows: finish your own job, else sign up, else finish
  // it on someone's behalf (managers). Anything else is in the "⋯" menu.
  let primary: ReactNode = null;
  let finishInMenu = false;
  if (status === "done") {
    primary = (
      <span className="flex items-center gap-1.5 font-sans text-sm font-semibold text-status-online">
        <CheckIcon size={16} /> Done
      </span>
    );
  } else if (canFinish && mine) {
    primary = (
      <Button size="sm" onClick={finish}>
        {finishLabel}
      </Button>
    );
  } else if (join && upcoming && !mine) {
    primary = (
      <Button size="sm" onClick={() => claim(task.id)}>
        Sign Up
      </Button>
    );
    finishInMenu = canFinish;
  } else if (canFinish) {
    primary = (
      <Button size="sm" variant="outline" onClick={finish}>
        {finishLabel}
      </Button>
    );
  } else if (mine && open) {
    primary = (
      <span className="flex items-center gap-1.5 rounded-xl bg-accent-light px-3 py-1.5 font-sans text-sm font-semibold text-accent">
        <CheckIcon size={15} /> You&apos;re in
      </span>
    );
  }

  const menu: MenuItem[] = [];
  if (finishInMenu) menu.push({ label: finishLabel, onSelect: finish });
  if (mine && join && upcoming && status !== "done")
    menu.push({
      label: "Leave this job",
      onSelect: () => unassign(task.id, user.id),
    });
  if (manage && status !== "done") menu.push({ label: "Assign people", onSelect: onAssign });
  if (manage && status === "done") menu.push({ label: "Reopen", onSelect: () => reopen(task.id) });
  if (manage && status !== "done")
    menu.push({
      label: "Remove job",
      onSelect: () => removeTask(task.id),
      danger: true,
    });

  return (
    <li
      className={cx(
        "flex gap-3 rounded-2xl border border-border bg-white p-4 md:gap-4",
        status === "done" && "bg-white/60",
      )}
    >
      <span aria-hidden="true" className="w-1.5 shrink-0 self-stretch rounded-full" style={{ background: color.fg }} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className={cx("min-w-0 flex-1", status === "done" && "opacity-60")}>
          <p className="font-sans text-xs font-semibold tracking-wide uppercase" style={{ color: color.fg }}>
            {taskTypeLabel[task.type]}
          </p>
          <p className={cx("font-sans text-base font-semibold", status === "done" && "line-through")}>{task.title}</p>
          <p className="text-sm text-muted">{treeLabel(task.bucketId)}</p>
          {task.notes ? <p className="mt-1 text-sm text-muted italic">{task.notes}</p> : null}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex shrink-0 -space-x-2">
              {assignees.map((member) => (
                <Avatar key={member.id} member={member} />
              ))}
              {open
                ? Array.from({ length: stillNeeded }).map((_, index) => (
                    <span
                      key={index}
                      className="h-7 w-7 rounded-full border-2 border-dashed border-[#C8CCC2] bg-white"
                      title="Open spot"
                    />
                  ))
                : null}
            </div>
            <span className="font-sans text-sm font-semibold" style={{ color: label.color }}>
              {label.text}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 sm:shrink-0">
          {primary}
          <MoreMenu items={menu} label={task.title} />
        </div>
      </div>
    </li>
  );
}
