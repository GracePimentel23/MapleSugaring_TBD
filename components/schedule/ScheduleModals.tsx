"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { useSchedule, type TaskSuggestion } from "@/components/schedule/ScheduleProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useStationCards } from "@/components/stations/StationStateProvider";
import { Button, Checkbox, Field, inputClass, Modal } from "@/components/ui/ui";
import {
  taskTypes,
  timeSlots,
  type ScheduleTask,
  type TaskType,
  type TimeSlot,
} from "@/lib/data/schedule";
import { demoWeather } from "@/lib/demo/weather";
import { monthDay, weekdayName } from "@/lib/time";

export function AssignModal({ task, onClose }: { task: ScheduleTask; onClose: () => void }) {
  const { members } = useSession();
  const { assign } = useSchedule();
  const [picked, setPicked] = useState<number[]>(task.assigneeIds);
  const active = members.filter((member) => member.status === "active");

  return (
    <Modal
      title="Assign people"
      eyebrow={task.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              assign(task.id, picked);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">
        Needs {task.spots} {task.spots === 1 ? "person" : "people"}. There is no cap; pick as many as you like.
      </p>
      <div className="space-y-3 pb-2">
        {active.map((member) => (
          <Checkbox
            key={member.id}
            label={member.name}
            checked={picked.includes(member.id)}
            onChange={(checked) =>
              setPicked((current) =>
                checked ? [...current, member.id] : current.filter((id) => id !== member.id),
              )
            }
          />
        ))}
      </div>
    </Modal>
  );
}

export function NewTaskModal({
  defaultDay,
  preset,
  defaultBucketId,
  onClose,
}: {
  defaultDay: number;
  preset?: TaskSuggestion;
  /** Pre-pick a tree (or null for the grove) when added from the tree grid */
  defaultBucketId?: number | null;
  onClose: () => void;
}) {
  const { dayIndex } = useDemo();
  const { user, members, can } = useSession();
  const { addTask } = useSchedule();
  const stations = useStationCards();
  const manage = can("schedule:manage");

  const [type, setType] = useState<TaskType>(
    preset?.type ?? (defaultBucketId === null ? "evaporator" : "collect"),
  );
  const [bucketId, setBucketId] = useState<number | null>(
    preset?.bucketId ?? defaultBucketId ?? stations[0]?.bucketId ?? null,
  );
  const [title, setTitle] = useState(preset?.title ?? "");
  const [day, setDay] = useState(Math.max(defaultDay, dayIndex));
  const [slot, setSlot] = useState<TimeSlot>(preset?.slot ?? "afternoon");
  const [spots, setSpots] = useState(preset?.spots ?? 1);
  const [assignees, setAssignees] = useState<number[]>(manage ? [] : [user.id]);
  const [notes, setNotes] = useState("");

  const typeInfo = taskTypes.find((item) => item.id === type)!;
  const bucket = stations.find((station) => station.bucketId === bucketId);
  const autoTitle =
    typeInfo.needsBucket && bucket
      ? type === "collect"
        ? `Collect ${bucket.name}`
        : type === "battery"
          ? `Replace ${bucket.name} battery`
          : `Check ${bucket.name} sensor`
      : typeInfo.label;

  function save() {
    addTask({
      type,
      title: title.trim() || autoTitle,
      bucketId: typeInfo.needsBucket ? bucketId : null,
      dayIndex: day,
      slot,
      spots,
      assigneeIds: assignees,
      notes: notes.trim() || undefined,
      suggestionKey: preset?.key,
    });
    onClose();
  }

  return (
    <Modal
      title="New task"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Add to Schedule</Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Job" hint={typeInfo.hint}>
          <select value={type} onChange={(event) => setType(event.target.value as TaskType)} className={inputClass}>
            {taskTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        {typeInfo.needsBucket ? (
          <Field label="Bucket">
            <select
              value={bucketId ?? ""}
              onChange={(event) => setBucketId(Number(event.target.value))}
              className={inputClass}
            >
              {stations.map((station) => (
                <option key={station.bucketId} value={station.bucketId}>
                  {station.shortName} · {station.treeLabel}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Title (optional)">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={autoTitle} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            <select value={day} onChange={(event) => setDay(Number(event.target.value))} className={inputClass}>
              {demoWeather.map((item, index) =>
                index >= dayIndex ? (
                  <option key={item.date} value={index}>
                    {weekdayName(item.date, "short")}, {monthDay(item.date)}
                    {index === dayIndex ? " (today)" : ""}
                  </option>
                ) : null,
              )}
            </select>
          </Field>
          <Field label="Time">
            <select value={slot} onChange={(event) => setSlot(event.target.value as TimeSlot)} className={inputClass}>
              {timeSlots.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}, {item.time}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="People needed" hint="A goal, not a limit. Anyone can still join once it is met.">
          <select value={spots} onChange={(event) => setSpots(Number(event.target.value))} className={inputClass}>
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </Field>
        {manage ? (
          <div>
            <p className="mb-2 text-sm text-muted">Assign now, or leave it open for sign-up</p>
            <div className="grid grid-cols-2 gap-3">
              {members
                .filter((member) => member.status === "active")
                .map((member) => (
                  <Checkbox
                    key={member.id}
                    label={member.name}
                    checked={assignees.includes(member.id)}
                    onChange={(checked) =>
                      setAssignees((current) =>
                        checked ? [...current, member.id] : current.filter((id) => id !== member.id),
                      )
                    }
                  />
                ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-bg px-4 py-3 text-sm text-muted">
            You will be signed up for this. Others can join if it needs more people.
          </p>
        )}
        <Field label="Notes (optional)">
          <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} resize-none`} />
        </Field>
      </div>
    </Modal>
  );
}
