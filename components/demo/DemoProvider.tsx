"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEMO_TOTAL_DAYS, getDemoDay, type DemoDay } from "@/lib/demo/timeline";

interface DemoContextValue {
  day: DemoDay;
  dayIndex: number;
  totalDays: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  next: () => void;
  prev: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export default function DemoProvider({ children }: { children: ReactNode }) {
  const [dayIndex, setDayIndex] = useState(0);

  const next = useCallback(() => {
    setDayIndex((current) => Math.min(current + 1, DEMO_TOTAL_DAYS - 1));
  }, []);

  const prev = useCallback(() => {
    setDayIndex((current) => Math.max(current - 1, 0));
  }, []);

  const jumpTo = useCallback((index: number) => {
    setDayIndex(Math.min(Math.max(index, 0), DEMO_TOTAL_DAYS - 1));
  }, []);

  const reset = useCallback(() => setDayIndex(0), []);

  // Arrow keys step through days so the demo can be driven without aiming at
  // a button, but not while someone is typing in a form.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable)) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, prev]);

  const value = useMemo<DemoContextValue>(
    () => ({
      day: getDemoDay(dayIndex),
      dayIndex,
      totalDays: DEMO_TOTAL_DAYS,
      canGoNext: dayIndex < DEMO_TOTAL_DAYS - 1,
      canGoPrev: dayIndex > 0,
      next,
      prev,
      jumpTo,
      reset,
    }),
    [dayIndex, next, prev, jumpTo, reset],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used inside DemoProvider");
  }
  return context;
}
