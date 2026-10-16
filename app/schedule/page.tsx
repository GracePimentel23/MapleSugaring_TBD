"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { CalendarIcon, PlusIcon } from "@/components/icons";
import { AssignModal, NewTaskModal } from "@/components/schedule/ScheduleModals";
import { useSchedule, useTaskSuggestions, type TaskSuggestion } from "@/components/schedule/ScheduleProvider";
import { CalendarView, TreeGridView, WeekStrip } from "@/components/schedule/ScheduleViews";
import TaskCard from "@/components/schedule/TaskCard";
import { useSession } from "@/components/session/SessionProvider";
import LogCollectionModal from "@/components/stations/LogCollectionModal";
import { Button, cx, EmptyState, FilterPill, PageHeader } from "@/components/ui/ui";
import { taskStatus, timeSlots, type ScheduleTask } from "@/lib/data/schedule";
import { demoWeather } from "@/lib/demo/weather";
import { monthDay, weekdayName } from "@/lib/time";

type Filter = "all" | "mine" | "open";
type View = "day" | "month" | "trees";

interface NewTaskRequest {
  preset?: TaskSuggestion;
  day?: number;
  bucketId?: number | null;
}

const needsPeople = (task: ScheduleTask, dayIndex: number) => ["open", "partial"].includes(taskStatus(task, dayIndex));

function dayName(index: number, today: number, long = false): string {
  const date = demoWeather[index]!.date;
  if (index === today) return "Today";
  if (index === today + 1) return "Tomorrow";
  return long ? weekdayName(date) : weekdayName(date, "short");
}

export default function SchedulePage() {
  const { dayIndex } = useDemo();
  const { user, can } = useSession();
  const { tasks, addTask, complete } = useSchedule();
  const suggestions = useTaskSuggestions();
  const [view, setView] = useState<View>("day");
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [newTask, setNewTask] = useState<NewTaskRequest | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [logging, setLogging] = useState<ScheduleTask | null>(null);
  const manage = can("schedule:manage");
  const join = can("schedule:join");

  // Follows the demo day until someone picks another day.
  const selectedDay = picked ?? dayIndex;
  const selectDay = (index: number) => setPicked(index === dayIndex ? null : index);
  // The month and tree views are for finding a day; picking one opens it.
  const openDay = (index: number) => {
    selectDay(index);
    setView("day");
  };

  const visible = tasks.filter((task) => {
    if (filter === "open") return needsPeople(task, dayIndex);
    if (filter === "mine") return task.assigneeIds.includes(user.id);
    return true;
  });
  const dayTasks = visible.filter((task) => task.dayIndex === selectedDay);
  const dayNeeding = dayTasks.filter((task) => needsPeople(task, dayIndex)).length;
  const slots = timeSlots
    .map((slot) => ({
      ...slot,
      tasks: dayTasks.filter((task) => task.slot === slot.id),
    }))
    .filter((slot) => slot.tasks.length > 0);

  const nextUp = tasks
    .filter(
      (task) =>
        task.assigneeIds.includes(user.id) && task.dayIndex >= dayIndex && taskStatus(task, dayIndex) !== "done",
    )
    .sort(
      (a, b) =>
        a.dayIndex - b.dayIndex ||
        timeSlots.findIndex((s) => s.id === a.slot) - timeSlots.findIndex((s) => s.id === b.slot),
    )[0];

  const showSuggestions = view === "day" && selectedDay === dayIndex && join && suggestions.length > 0;
  const date = demoWeather[selectedDay]!.date;
  const canAddHere = join && selectedDay >= dayIndex;

  function takeSuggestion(suggestion: TaskSuggestion, mode: "me" | "post") {
    addTask({
      type: suggestion.type,
      title: suggestion.title,
      bucketId: suggestion.bucketId,
      dayIndex,
      slot: suggestion.slot,
      spots: suggestion.spots,
      assigneeIds: mode === "me" ? [user.id] : [],
      suggestionKey: suggestion.key,
    });
  }

  const assigningTask = tasks.find((task) => task.id === assigning) ?? null;

  return (
    <div className="w-full px-4 pt-2 pb-10 md:px-6 lg:px-10">
      <PageHeader
        title="Schedule"
        subtitle="Pick a day and sign up for a job. There is no limit, so anyone can pitch in."
        actions={
          join ? (
            <Button onClick={() => setNewTask({ day: selectedDay })}>
              <PlusIcon size={16} />
              New Job
            </Button>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-border bg-white p-1" role="tablist" aria-label="Schedule view">
          {(
            [
              ["day", "Day"],
              ["month", "Month"],
              ["trees", "By Tree"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cx(
                "rounded-lg px-4 py-1.5 font-sans text-sm font-semibold transition-colors",
                view === id ? "bg-accent text-white" : "text-muted hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
          {(
            [
              ["all", "All jobs"],
              ["mine", "My jobs"],
              ["open", "Needs people"],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <FilterPill key={id} label={label} active={filter === id} onClick={() => setFilter(id)} />
          ))}
        </div>
      </div>

      {view === "day" ? (
        <div className="mx-auto max-w-4xl">
          <WeekStrip tasks={visible} selectedDay={selectedDay} onSelectDay={selectDay} />

          {nextUp && join ? (
            <button
              type="button"
              onClick={() => selectDay(nextUp.dayIndex)}
              className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-accent-light px-4 py-3 text-left transition-colors hover:bg-accent-light/70"
            >
              <CalendarIcon size={20} className="shrink-0 text-accent" />
              <span className="min-w-0 text-sm">
                <span className="font-sans font-semibold text-accent">Your next job: </span>
                <span className="text-text">
                  {nextUp.title} · {dayName(nextUp.dayIndex, dayIndex)},{" "}
                  {timeSlots.find((slot) => slot.id === nextUp.slot)?.label.toLowerCase()}
                </span>
              </span>
            </button>
          ) : null}

          <div className="mt-6 mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-sans text-xl font-semibold">
              {dayName(selectedDay, dayIndex, true)}, {monthDay(date)}
            </h2>
            <p className="text-sm text-muted">
              {dayTasks.length} job{dayTasks.length === 1 ? "" : "s"}
              {dayNeeding ? (
                <>
                  {" · "}
                  <span className="font-semibold text-status-due">{dayNeeding} need people</span>
                </>
              ) : null}
            </p>
          </div>

          {showSuggestions ? (
            <section className="mb-6 rounded-2xl border border-[#F0D9BC] bg-[#FDF6EC] p-4">
              <h3 className="font-sans text-base font-semibold text-[#4A2E0E]">Needs someone today</h3>
              <p className="mb-3 text-sm text-[#8A5A1C]">Not on the schedule yet. Take one and it is added for you.</p>
              <ul className="divide-y divide-[#F0D9BC]">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-sans text-sm font-semibold text-text">{suggestion.title}</p>
                      <p className="text-xs text-muted">{suggestion.reason}</p>
                    </div>
                    <div className="flex gap-1">
                      {manage ? (
                        <Button size="sm" variant="ghost" onClick={() => takeSuggestion(suggestion, "post")}>
                          Post It
                        </Button>
                      ) : null}
                      <Button size="sm" onClick={() => takeSuggestion(suggestion, "me")}>
                        I&apos;ll Do It
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {slots.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarIcon size={22} />}
              title={filter === "all" ? "Nothing scheduled" : "No jobs match"}
              description={
                filter !== "all"
                  ? "Try All jobs to see everything on this day."
                  : selectedDay >= dayIndex
                    ? "Add a job so people can sign up."
                    : "No jobs were planned for this day."
              }
              action={
                canAddHere && filter === "all" ? (
                  <Button size="sm" onClick={() => setNewTask({ day: selectedDay })}>
                    <PlusIcon size={14} />
                    Add a Job
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-6">
              {slots.map((slot) => (
                <section key={slot.id}>
                  <h3 className="mb-2 flex items-baseline gap-2 font-sans text-sm font-semibold">
                    {slot.label}
                    <span className="font-normal text-muted">{slot.time}</span>
                  </h3>
                  <ul className="space-y-3">
                    {slot.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onAssign={() => setAssigning(task.id)}
                        onLog={() => setLogging(task)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {view === "month" ? (
            <CalendarView
              tasks={visible}
              selectedDay={selectedDay}
              onSelectDay={openDay}
              onOpenTask={(task) => openDay(task.dayIndex)}
            />
          ) : (
            <TreeGridView
              tasks={visible}
              selectedDay={selectedDay}
              onSelectDay={openDay}
              onOpenTask={(task) => openDay(task.dayIndex)}
              onAdd={(bucketId, day) => setNewTask({ bucketId, day })}
            />
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-status-attention" /> still needs people · tap a day to see its
            jobs
            {view === "trees" ? ", or + in a cell to add one there" : ""}
          </p>
        </>
      )}

      {newTask ? (
        <NewTaskModal
          defaultDay={newTask.day ?? selectedDay}
          preset={newTask.preset}
          defaultBucketId={newTask.bucketId}
          onClose={() => setNewTask(null)}
        />
      ) : null}
      {assigningTask ? <AssignModal task={assigningTask} onClose={() => setAssigning(null)} /> : null}
      {logging && logging.bucketId !== null ? (
        <LogCollectionModal
          bucketId={logging.bucketId}
          onClose={() => setLogging(null)}
          onLogged={() => complete(logging.id)}
        />
      ) : null}
    </div>
  );
}
