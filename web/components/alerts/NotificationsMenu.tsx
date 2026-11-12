"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AlertIcon from "@/components/alerts/AlertIcon";
import { BellIcon, ChevronRightIcon } from "@/components/icons";
import { useAlerts } from "@/components/stations/StationStateProvider";
import { cx } from "@/components/ui/ui";

/**
 * The bell and its panel. Nothing is dismissed here: each notification goes to the Alerts page and
 * opens that alert's resolve pop-up, which walks through what to do.
 */
export default function NotificationsMenu({ onDark = false }: { onDark?: boolean }) {
  const { active } = useAlerts();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          active.length
            ? `Notifications, ${active.length} need${active.length === 1 ? "s" : ""} attention`
            : "Notifications"
        }
        className={cx(
          "relative rounded-lg p-1.5 transition-colors",
          onDark ? "text-white hover:bg-white/10" : "text-text hover:bg-black/5",
        )}
      >
        <BellIcon size={26} />
        {active.length > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-status-problem px-1 text-[12px] font-bold text-white">
            {active.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed top-16 right-3 left-3 z-50 overflow-hidden rounded-2xl bg-white text-left text-text shadow-xl md:absolute md:top-full md:right-0 md:left-auto md:mt-2 md:w-[400px]"
        >
          <div className="border-b border-border px-5 py-4">
            <p className="font-sans text-base font-semibold">Notifications</p>
            <p className="text-sm text-muted">
              {active.length === 0
                ? "You're all caught up."
                : `${active.length} alert${active.length === 1 ? "" : "s"} to resolve`}
            </p>
          </div>

          <ul className="max-h-[min(60vh,26rem)] divide-y divide-border overflow-y-auto overscroll-contain">
            {active.map((alert) => (
              <li key={alert.key}>
                <Link
                  href={`/alerts?alert=${encodeURIComponent(alert.key)}`}
                  onClick={() => setOpen(false)}
                  className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-bg"
                >
                  <span className="mt-0.5">
                    <AlertIcon kind={alert.kind} size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans text-body font-semibold">{alert.title}</span>
                    <span className="block text-sm text-muted">{alert.advice}</span>
                  </span>
                  <ChevronRightIcon size={18} className="mt-1 shrink-0 text-muted group-hover:text-text" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-border px-5 py-3 text-right">
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="font-sans text-sm font-semibold text-accent-mid hover:underline"
            >
              View all alerts
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
