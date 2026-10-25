export type DataSectionId = "overview" | "collections" | "batches" | "analysis";

export const dataSections: { id: DataSectionId; label: string; href: string }[] = [
  { id: "overview", label: "Overview", href: "/data/overview" },
  { id: "collections", label: "Collections", href: "/data/collections" },
  { id: "batches", label: "Batches", href: "/data/batches" },
  { id: "analysis", label: "Analysis", href: "/data/analysis" },
];

export function isDataSection(value: string): value is DataSectionId {
  return dataSections.some((section) => section.id === value);
}
