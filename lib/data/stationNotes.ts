import type { StationNote } from "@/lib/types/schema";

/**
 * Notes left on buckets before the demo window opens, newest first. Buckets
 * without an entry have no notes yet.
 */
export const seedStationNotes: Record<number, StationNote[]> = {
  1: [
    {
      text: "Repositioned the sensor after tapping. Reading steady.",
      author: "Mr. Adams",
      createdAt: "Feb 27, 2022 at 3:42 PM",
    },
  ],
  4: [
    {
      text: "Node drops out now and then. Reseated the antenna cable.",
      author: "Jordan T.",
      createdAt: "Feb 25, 2022 at 11:08 AM",
    },
  ],
  5: [
    {
      text: "Battery is older than the rest. Keep a spare in the shed.",
      author: "Chloe M.",
      createdAt: "Feb 26, 2022 at 9:15 AM",
    },
    {
      text: "Installed on the west side of the tree, away from the fence line.",
      author: "Sam R.",
      createdAt: "Feb 16, 2022 at 9:20 AM",
    },
  ],
};

/** "2022-03-04" + now -> "Mar 4, 2022 at 3:42 PM", dated inside the demo window. */
export function formatNoteTimestamp(isoDate: string, now: Date): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}
