"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { DataSource } from "@/lib/data/source";

/**
 * Keeps the page live: every few seconds it asks the worker for GET /live (a short version string)
 * and re-renders the page's server data only when that changed, so new load cell readings appear
 * without a reload and an idle page costs one tiny request per tick. If /live is not available it
 * falls back to re-rendering every tick. Shows a small badge saying which data is on screen.
 */
export default function LiveRefresh({
  source,
  seconds = 5,
}: {
  source: DataSource;
  seconds?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (source !== "live") return;
    let version: string | null = null;
    let first = true; // the page was just rendered, so the first answer only sets the baseline
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        const next = response.ok ? ((await response.json()) as { version?: string }).version ?? null : null;
        if (!first && (next === null || next !== version)) router.refresh();
        version = next;
      } catch {
        if (!first) router.refresh();
      } finally {
        first = false;
        busy = false;
      }
    };
    void tick();
    const timer = setInterval(tick, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds, source]);

  const live = source === "live";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      title={live ? `Live data, refreshing every ${seconds}s` : "API not connected: showing sample data"}
      style={{
        background: live ? "rgba(22,163,74,0.1)" : "rgba(245,158,11,0.12)",
        color: live ? "#15803D" : "#B45309",
      }}
    >
      <span style={{ fontSize: 8 }}>●</span>
      {live ? "Live" : "Sample data"}
    </span>
  );
}
