"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { DataSource } from "@/lib/data/source";

/**
 * Re-renders the page's server data every few seconds while it is showing live data, so new
 * load cell readings appear without a reload. Shows a small badge saying which data is on screen.
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
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
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
