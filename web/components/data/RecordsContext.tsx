"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { RecordsData } from "@/lib/data/source";

/** Collections, batches, seasons and bucket names for the Data tab, loaded once by app/data/page.tsx. */
const RecordsContext = createContext<RecordsData | null>(null);

export function RecordsProvider({ value, children }: { value: RecordsData; children: ReactNode }) {
  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecords(): RecordsData {
  const records = useContext(RecordsContext);
  if (!records) throw new Error("useRecords must be used inside <RecordsProvider>");
  return records;
}
