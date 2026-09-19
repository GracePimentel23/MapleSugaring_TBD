"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { demoTimeline } from "@/lib/demo/timeline";

/** Days worth flagging on the scrubber so the presenter can see what is coming. */
const dayMarkers = demoTimeline.map((day) => ({
  hasAlert: day.alerts.some((alert) => !alert.is_resolved),
  hasBanner: Boolean(day.meta.weatherAlert),
}));

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11 4l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M7 4l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DemoControls() {
  const { day, dayIndex, totalDays, canGoNext, canGoPrev, next, prev, jumpTo, reset } =
    useDemo();
  const [scriptOpen, setScriptOpen] = useState(true);

  return (
    <div
      className="shrink-0 pb-[68px] md:pb-0"
      style={{ background: "#2B4A1E", borderTop: "1px solid rgba(255,255,255,0.12)" }}
    >
      {scriptOpen ? (
        <div
          className="px-4 pt-3.5 pb-1 md:px-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex flex-col gap-2 pb-3 lg:flex-row lg:gap-8">
            <div className="min-w-0 lg:flex-1">
              <h3 className="font-sans text-sm font-semibold text-white">
                {day.narration.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-white/75">
                {day.narration.script}
              </p>
            </div>
            <ul className="flex shrink-0 flex-col gap-1 lg:w-[340px]">
              {day.narration.beats.map((beat) => (
                <li key={beat} className="flex gap-2 text-xs text-white/80">
                  <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-white/50" />
                  <span>{beat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
        <span className="rounded-full bg-white/15 px-2 py-0.5 font-sans text-[10px] font-bold tracking-widest text-white">
          DEMO
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prev}
            disabled={!canGoPrev}
            aria-label="Previous day"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!canGoNext}
            aria-label="Next day"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight />
          </button>
        </div>

        <div className="min-w-0">
          <div className="font-sans text-sm font-semibold text-white">
            Day {day.dayNumber} of {totalDays}
          </div>
          <div className="text-xs text-white/60">
            {day.weather.label}, 2022 · Rochester, NY
          </div>
        </div>

        <div className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
          {dayMarkers.map((marker, index) => {
            const isCurrent = index === dayIndex;
            const isPast = index < dayIndex;

            return (
              <button
                key={index}
                type="button"
                onClick={() => jumpTo(index)}
                aria-label={`Jump to day ${index + 1}`}
                aria-current={isCurrent ? "true" : undefined}
                className="group relative flex h-6 w-5 items-center justify-center"
              >
                <span
                  className="rounded-full transition-all"
                  style={{
                    width: isCurrent ? 10 : 7,
                    height: isCurrent ? 10 : 7,
                    background: isCurrent
                      ? "#FFFFFF"
                      : marker.hasAlert
                        ? "#F59E0B"
                        : isPast
                          ? "rgba(255,255,255,0.55)"
                          : "rgba(255,255,255,0.25)",
                  }}
                />
                {marker.hasBanner ? (
                  <span className="absolute top-0 right-0.5 h-1 w-1 rounded-full bg-red-400" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-white/45 lg:inline">
            Arrow keys to step
          </span>
          <button
            type="button"
            onClick={() => setScriptOpen((open) => !open)}
            className="rounded-lg px-2.5 py-1.5 font-sans text-xs font-medium text-white/85 transition-colors hover:bg-white/15"
          >
            {scriptOpen ? "Hide script" : "Show script"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg px-2.5 py-1.5 font-sans text-xs font-medium text-white/85 transition-colors hover:bg-white/15"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
