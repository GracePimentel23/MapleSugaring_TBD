import type { BatchStatus } from "@/lib/types/schema";

/** "active" reads Collecting and "processing" reads Boiling everywhere in the UI. */
export const batchStatusStyles: Record<
  BatchStatus,
  { bg: string; color: string; label: string }
> = {
  completed: { bg: "rgba(34,197,94,0.1)", color: "#16A34A", label: "Completed" },
  processing: { bg: "rgba(245,158,11,0.1)", color: "#D97706", label: "Boiling" },
  active: { bg: "var(--color-accent-light)", color: "#4A7A33", label: "Collecting" },
  waiting: { bg: "rgba(107,114,128,0.1)", color: "#6B7280", label: "Waiting" },
};

export const batchStatusLabel: Record<BatchStatus, string> = {
  completed: batchStatusStyles.completed.label,
  processing: batchStatusStyles.processing.label,
  active: batchStatusStyles.active.label,
  waiting: batchStatusStyles.waiting.label,
};

/** The Batch dropdown's "+ Start a new batch": the batch is only created when the form is saved. */
export const NEW_BATCH = "__new__";

export const newBatchOption = {
  value: NEW_BATCH,
  label: "+ Start a new batch",
  detail: "Created when you save, starting today",
};

/**
 * A collection still taking sap: its batch is still collecting, or it is not in a batch yet.
 * Waiting, boiling and completed ones are closed: that sap is already in storage or the evaporator.
 */
export function collectionIsOpen(batches: { batchNumber: string; status: BatchStatus }[], batchName: string): boolean {
  const batch = batches.find((item) => item.batchNumber === batchName);
  return !batch || batch.status === "active";
}
