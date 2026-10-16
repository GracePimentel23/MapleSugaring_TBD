/**
 * The club's work schedule: jobs at the trees, the evaporator and the shed
 * that members sign up for. Each task sits on one demo day in one time slot.
 */

export type TaskType =
  | "collect"
  | "battery"
  | "sensor"
  | "evaporator"
  | "cleaning"
  | "weather"
  | "bottling"
  | "tapping"
  | "other";

export const taskTypes: { id: TaskType; label: string; hint: string; needsBucket: boolean }[] = [
  { id: "collect", label: "Collect sap", hint: "Empty a bucket into the storage tank.", needsBucket: true },
  { id: "battery", label: "Replace battery", hint: "Swap the sensor battery.", needsBucket: true },
  { id: "sensor", label: "Check sensor", hint: "Reseat, clean or replace a sensor that is acting up.", needsBucket: true },
  { id: "evaporator", label: "Evaporator shift", hint: "Feed the fire and watch the boil.", needsBucket: false },
  { id: "cleaning", label: "Clean equipment", hint: "Wash buckets, lids, tanks or filters.", needsBucket: false },
  { id: "weather", label: "Storm prep / check", hint: "Bring buckets in before a storm, or check them after.", needsBucket: false },
  { id: "bottling", label: "Filter and bottle", hint: "Filter finished syrup, grade it, record Brix.", needsBucket: false },
  { id: "tapping", label: "Tap or pull taps", hint: "Start or end of the season at the trees.", needsBucket: false },
  { id: "other", label: "Other", hint: "Anything else the club needs.", needsBucket: false },
];

export const taskTypeLabel = Object.fromEntries(taskTypes.map((type) => [type.id, type.label])) as Record<
  TaskType,
  string
>;

export type TimeSlot = "morning" | "midday" | "afternoon" | "evening";

export const timeSlots: { id: TimeSlot; label: string; time: string }[] = [
  { id: "morning", label: "Morning", time: "7:30–9:00 AM" },
  { id: "midday", label: "Midday", time: "11:30 AM–1:00 PM" },
  { id: "afternoon", label: "After school", time: "3:00–5:00 PM" },
  { id: "evening", label: "Evening", time: "6:00–8:00 PM" },
];

export const timeSlotLabel = Object.fromEntries(
  timeSlots.map((slot) => [slot.id, `${slot.label}, ${slot.time}`]),
) as Record<TimeSlot, string>;

export interface ScheduleTask {
  id: string;
  type: TaskType;
  title: string;
  /** null for jobs that are not at one tree */
  bucketId: number | null;
  dayIndex: number;
  slot: TimeSlot;
  /** How many people the job needs */
  spots: number;
  assigneeIds: number[];
  notes?: string;
  /** The alert or batch suggestion this task was made from, if any */
  suggestionKey?: string;
  createdBy: string;
  /** Set when someone marks it done */
  doneBy?: string;
  doneAt?: string;
  /** Seeded history: counts as done once the demo has moved past its day */
  seededDone?: boolean;
}

export type TaskStatus = "open" | "partial" | "filled" | "done" | "missed";

export function taskStatus(task: ScheduleTask, dayIndex: number): TaskStatus {
  if (task.doneBy || (task.seededDone && dayIndex > task.dayIndex)) return "done";
  if (dayIndex > task.dayIndex) return "missed";
  if (task.assigneeIds.length === 0) return "open";
  return task.assigneeIds.length >= task.spots ? "filled" : "partial";
}

/** Member ids, see people.ts */
const DANA = 1;
const GRACE = 2;
const ADAMS = 3;
const SAM = 4;
const CHLOE = 5;
const JORDAN = 6;

/**
 * Two weeks of club work, lined up with the demo script: the collections on
 * Mar 6, 8 and 10, the snow on Mar 8, and the boils of Batch #01 and #02.
 */
export const seedTasks: ScheduleTask[] = [
  { id: "s1", type: "tapping", title: "Opening walk: check every tap and bucket", bucketId: null, dayIndex: 0, slot: "afternoon", spots: 2, assigneeIds: [GRACE, CHLOE], createdBy: "Grace P.", seededDone: true },
  { id: "s2", type: "cleaning", title: "Wash spare buckets and lids", bucketId: null, dayIndex: 2, slot: "afternoon", spots: 2, assigneeIds: [JORDAN], createdBy: "Mr. Adams", seededDone: true },
  { id: "s3", type: "collect", title: "Collect Bucket #01", bucketId: 1, dayIndex: 5, slot: "morning", spots: 1, assigneeIds: [CHLOE], createdBy: "Mr. Adams", seededDone: true },
  { id: "s4", type: "collect", title: "Collect Bucket #03", bucketId: 3, dayIndex: 5, slot: "morning", spots: 1, assigneeIds: [CHLOE], createdBy: "Mr. Adams", seededDone: true },
  { id: "s5", type: "cleaning", title: "Stack wood by the evaporator", bucketId: null, dayIndex: 6, slot: "afternoon", spots: 2, assigneeIds: [SAM, JORDAN], createdBy: "Mr. Adams", seededDone: true },
  { id: "s6", type: "weather", title: "Empty and bring buckets in before the snow", bucketId: null, dayIndex: 7, slot: "morning", spots: 2, assigneeIds: [ADAMS, JORDAN], createdBy: "Mr. Adams", notes: "#02, #04 and #05 come inside.", seededDone: true },
  { id: "s7", type: "evaporator", title: "Evaporator shift: Batch #01", bucketId: null, dayIndex: 7, slot: "afternoon", spots: 2, assigneeIds: [ADAMS, CHLOE], createdBy: "Mr. Adams", seededDone: true },
  { id: "s8", type: "weather", title: "Rehang buckets after the snow", bucketId: null, dayIndex: 8, slot: "afternoon", spots: 2, assigneeIds: [GRACE], createdBy: "Grace P.", seededDone: true },
  { id: "s9", type: "collect", title: "Collect Bucket #01", bucketId: 1, dayIndex: 9, slot: "morning", spots: 1, assigneeIds: [SAM], createdBy: "Sam R.", seededDone: true },
  { id: "s9b", type: "collect", title: "Collect Bucket #03", bucketId: 3, dayIndex: 9, slot: "morning", spots: 1, assigneeIds: [SAM], createdBy: "Sam R.", seededDone: true },
  { id: "s10", type: "evaporator", title: "Evaporator shift: Batch #02", bucketId: null, dayIndex: 10, slot: "afternoon", spots: 2, assigneeIds: [ADAMS, SAM], createdBy: "Mr. Adams" },
  { id: "s11", type: "battery", title: "Replace Bucket #05 battery", bucketId: 5, dayIndex: 10, slot: "afternoon", spots: 1, assigneeIds: [], createdBy: "Grace P.", notes: "Spare batteries are on the shelf in the shed." },
  { id: "s12", type: "evaporator", title: "Evaporator shift: Batch #02, finish", bucketId: null, dayIndex: 11, slot: "afternoon", spots: 2, assigneeIds: [ADAMS], createdBy: "Mr. Adams" },
  { id: "s13", type: "bottling", title: "Filter and bottle Batch #01 syrup", bucketId: null, dayIndex: 11, slot: "evening", spots: 2, assigneeIds: [], createdBy: "Grace P." },
  { id: "s14", type: "sensor", title: "Check lines and sensors after the hard freeze", bucketId: null, dayIndex: 12, slot: "afternoon", spots: 1, assigneeIds: [], createdBy: "Dana K." },
  { id: "s15", type: "collect", title: "Collect every bucket: peak run", bucketId: null, dayIndex: 13, slot: "morning", spots: 3, assigneeIds: [SAM], createdBy: "Mr. Adams" },
  { id: "s16", type: "bottling", title: "Grade syrup and record Brix", bucketId: null, dayIndex: 13, slot: "afternoon", spots: 1, assigneeIds: [GRACE], createdBy: "Grace P." },
  { id: "s17", type: "tapping", title: "End of season: pull taps and clean up", bucketId: null, dayIndex: 13, slot: "afternoon", spots: 4, assigneeIds: [DANA], createdBy: "Dana K." },
];
