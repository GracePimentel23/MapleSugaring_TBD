"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useAlerts } from "@/components/stations/StationStateProvider";
import {
  seedTasks,
  taskStatus,
  type ScheduleTask,
  type TaskType,
  type TimeSlot,
} from "@/lib/data/schedule";
import { tableStamp } from "@/lib/time";

interface ScheduleValue {
  tasks: ScheduleTask[];
  addTask: (task: Omit<ScheduleTask, "id" | "createdBy">) => void;
  /** Sign the current user up */
  claim: (taskId: string) => void;
  /** Take someone off a task (yourself, or anyone if you manage the schedule) */
  unassign: (taskId: string, memberId: number) => void;
  /** Replace the people on a task (managers) */
  assign: (taskId: string, memberIds: number[]) => void;
  complete: (taskId: string) => void;
  reopen: (taskId: string) => void;
  removeTask: (taskId: string) => void;
}

const ScheduleContext = createContext<ScheduleValue | null>(null);

export default function ScheduleProvider({ children }: { children: ReactNode }) {
  const { day } = useDemo();
  const { user, logAudit } = useSession();
  const [tasks, setTasks] = useState<ScheduleTask[]>(seedTasks);
  const [nextId, setNextId] = useState(1);

  const update = useCallback(
    (taskId: string, change: (task: ScheduleTask) => ScheduleTask) =>
      setTasks((current) => current.map((task) => (task.id === taskId ? change(task) : task))),
    [],
  );

  const titleOf = useCallback(
    (taskId: string) => tasks.find((task) => task.id === taskId)?.title ?? "Task",
    [tasks],
  );

  const log = useCallback(
    (action: string, record: string, change: string) =>
      logAudit({ when: tableStamp(day.date), action, record, change }),
    [logAudit, day.date],
  );

  const addTask = useCallback<ScheduleValue["addTask"]>(
    (task) => {
      setTasks((current) => [...current, { ...task, id: `t${nextId}`, createdBy: user.name }]);
      setNextId((id) => id + 1);
      log("Scheduled task", task.title, task.assigneeIds.length ? "Assigned" : "Open for sign-up");
    },
    [nextId, user.name, log],
  );

  const claim = useCallback(
    (taskId: string) => {
      update(taskId, (task) =>
        task.assigneeIds.includes(user.id) ? task : { ...task, assigneeIds: [...task.assigneeIds, user.id] },
      );
      log("Signed up", titleOf(taskId), user.name);
    },
    [update, user.id, user.name, log, titleOf],
  );

  const unassign = useCallback(
    (taskId: string, memberId: number) => {
      update(taskId, (task) => ({ ...task, assigneeIds: task.assigneeIds.filter((id) => id !== memberId) }));
      log("Left task", titleOf(taskId), memberId === user.id ? user.name : "Removed by a manager");
    },
    [update, user.id, user.name, log, titleOf],
  );

  const assign = useCallback(
    (taskId: string, memberIds: number[]) => {
      update(taskId, (task) => ({ ...task, assigneeIds: memberIds }));
      log("Assigned task", titleOf(taskId), `${memberIds.length} people`);
    },
    [update, log, titleOf],
  );

  const complete = useCallback(
    (taskId: string) => {
      update(taskId, (task) => ({ ...task, doneBy: user.name, doneAt: tableStamp(day.date) }));
      log("Completed task", titleOf(taskId), "Done");
    },
    [update, user.name, day.date, log, titleOf],
  );

  const reopen = useCallback(
    (taskId: string) => update(taskId, (task) => ({ ...task, doneBy: undefined, doneAt: undefined, seededDone: false })),
    [update],
  );

  const removeTask = useCallback(
    (taskId: string) => {
      log("Removed task", titleOf(taskId), "Deleted");
      setTasks((current) => current.filter((task) => task.id !== taskId));
    },
    [log, titleOf],
  );

  const value = useMemo<ScheduleValue>(
    () => ({ tasks, addTask, claim, unassign, assign, complete, reopen, removeTask }),
    [tasks, addTask, claim, unassign, assign, complete, reopen, removeTask],
  );

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule(): ScheduleValue {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error("useSchedule must be used inside ScheduleProvider");
  return context;
}

export interface TaskSuggestion {
  key: string;
  type: TaskType;
  title: string;
  bucketId: number | null;
  reason: string;
  slot: TimeSlot;
  spots: number;
  /** For evaporator jobs, so a seeded shift for the same batch counts */
  batchNumber?: string;
}

/**
 * Jobs today's alerts and batches call for that nobody has scheduled yet.
 * Members can take one on the spot; managers can post it for sign-up.
 */
export function useTaskSuggestions(): TaskSuggestion[] {
  const { day, dayIndex } = useDemo();
  const { active, acknowledged } = useAlerts();
  const { tasks } = useSchedule();

  return useMemo(() => {
    const suggestions: TaskSuggestion[] = [];

    for (const alert of [...active, ...acknowledged]) {
      if (alert.kind === "due" || alert.kind === "full" || alert.kind === "sapAge") {
        suggestions.push({
          key: `collect-${alert.bucketId}`,
          type: "collect",
          title: `Collect Bucket ${alert.bucketLabel}`,
          bucketId: alert.bucketId,
          reason: alert.title,
          slot: alert.kind === "full" ? "morning" : "afternoon",
          spots: 1,
        });
      } else if (alert.kind === "battery") {
        suggestions.push({
          key: `battery-${alert.bucketId}`,
          type: "battery",
          title: `Replace Bucket ${alert.bucketLabel} battery`,
          bucketId: alert.bucketId,
          reason: alert.title,
          slot: "afternoon",
          spots: 1,
        });
      } else if (alert.kind === "offline") {
        suggestions.push({
          key: `sensor-${alert.bucketId}`,
          type: "sensor",
          title: `Check Bucket ${alert.bucketLabel} sensor`,
          bucketId: alert.bucketId,
          reason: alert.title,
          slot: "afternoon",
          spots: 1,
        });
      } else if (alert.kind === "weather") {
        suggestions.push({
          key: "weather",
          type: "weather",
          title: "Storm check at the grove",
          bucketId: null,
          reason: alert.title,
          slot: "afternoon",
          spots: 2,
        });
      }
    }

    for (const batch of day.batches) {
      if (batch.status === "processing") {
        suggestions.push({
          key: `evaporator-${batch.batchNumber}`,
          type: "evaporator",
          title: `Evaporator shift: ${batch.batchNumber}`,
          bucketId: null,
          reason: `${batch.batchNumber} is on the evaporator`,
          batchNumber: batch.batchNumber,
          slot: "afternoon",
          spots: 2,
        });
      } else if (batch.status === "waiting") {
        suggestions.push({
          key: `evaporator-${batch.batchNumber}`,
          type: "evaporator",
          title: `Start boiling ${batch.batchNumber}`,
          bucketId: null,
          reason: `${batch.batchNumber} is waiting in storage`,
          batchNumber: batch.batchNumber,
          slot: "afternoon",
          spots: 2,
        });
      }
    }

    // Skip anything already on today's or a later schedule.
    const planned = tasks.filter(
      (task) => task.dayIndex >= dayIndex && taskStatus(task, dayIndex) !== "done",
    );
    const covered = (suggestion: TaskSuggestion) =>
      planned.some(
        (task) =>
          task.suggestionKey === suggestion.key ||
          (suggestion.bucketId !== null &&
            task.type === suggestion.type &&
            task.bucketId === suggestion.bucketId) ||
          (suggestion.batchNumber !== undefined &&
            task.type === "evaporator" &&
            task.title.includes(suggestion.batchNumber)),
      );
    return suggestions.filter(
      (suggestion, index, all) =>
        all.findIndex((item) => item.key === suggestion.key) === index && !covered(suggestion),
    );
  }, [active, acknowledged, day.batches, tasks, dayIndex]);
}
