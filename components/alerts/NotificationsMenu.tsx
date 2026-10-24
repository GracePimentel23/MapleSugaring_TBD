"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AlertIcon from "@/components/alerts/AlertIcon";
import { BellIcon, CheckIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { useAlerts, useStationState } from "@/components/stations/StationStateProvider";
import { cx } from "@/components/ui/ui";
import type { ClubAlert } from "@/lib/types/schema";

/** How long "Undo" stays offered after someone takes an alert. */
const UNDO_MS = 6000;

/**
 * The bell and its panel: the one place alerts show outside the Alerts page.
 * "Mark as read" acknowledges an alert: it leaves the unread count and moves to
 * Acknowledged on the Alerts page, so the club knows someone has seen it. It
 * does not mark it fixed; that happens where the work is done, or on the Alerts
 * page. A slip is one tap to take back with Undo.
 */
export default function NotificationsMenu({ onDark = false }: { onDark?: boolean }) {
  const router = useRouter();
  const { can } = useSession();
  const { active } = useAlerts();
  const { acknowledge, unacknowledge, focusStation } = useStationState();
  const [open, setOpen] = useState(false);
  const [taken, setTaken] = useState<{ alert: ClubAlert; at: number }[]>([]);
  const menu = useRef<HTMLDivElement>(null);
  const canRespond = can("alerts:resolve");

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

  // Drop the Undo rows once their time is up.
  useEffect(() => {
    if (taken.length === 0) return;
    const oldest = Math.min(...taken.map((item) => item.at));
    const timer = setTimeout(
      () => setTaken((current) => current.filter((item) => Date.now() - item.at < UNDO_MS)),
      Math.max(oldest + UNDO_MS - Date.now(), 0),
    );
    return () => clearTimeout(timer);
  }, [taken]);

  function take(alert: ClubAlert) {
    acknowledge(alert);
    setTaken((current) => [...current, { alert, at: Date.now() }]);
  }

  function takeAll() {
    const now = Date.now();
    active.forEach((alert) => acknowledge(alert));
    setTaken((current) => [...current, ...active.map((alert) => ({ alert, at: now }))]);
  }

  function undo(alert: ClubAlert) {
    unacknowledge(alert.key);
    setTaken((current) => current.filter((item) => item.alert.key !== alert.key));
  }

  function openStation(bucketId: number) {
    setOpen(false);
    focusStation(bucketId);
    router.push("/stations");
  }

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
          className="fixed top-16 right-3 left-3 z-50 overflow-hidden rounded-2xl border border-border bg-white text-left text-text shadow-xl md:absolute md:top-full md:right-0 md:left-auto md:mt-2 md:w-[400px]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="font-sans text-base font-semibold">Notifications</p>
              <p className="text-sm text-muted">
                {active.length === 0 ? "You're all caught up." : `${active.length} unread`}
              </p>
            </div>
            {canRespond && active.length > 1 ? (
              <button
                type="button"
                onClick={takeAll}
                className="shrink-0 rounded-lg px-2 py-1 font-sans text-sm font-semibold text-accent-mid hover:bg-accent-light"
              >
                Mark all as read
              </button>
            ) : null}
          </div>

          <ul className="max-h-[min(60vh,26rem)] divide-y divide-border overflow-y-auto overscroll-contain">
            {active.map((alert) => (
              <li key={alert.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
                <button
                  type="button"
                  disabled={alert.bucketId === null}
                  onClick={() => alert.bucketId !== null && openStation(alert.bucketId)}
                  className="group flex min-w-0 flex-1 basis-56 items-start gap-3 text-left disabled:cursor-default"
                >
                  <span className="mt-0.5">
                    <AlertIcon kind={alert.kind} size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-sans text-body font-semibold group-enabled:group-hover:underline">
                      {alert.title}
                    </span>
                    <span className="block text-sm text-muted">{alert.advice}</span>
                  </span>
                </button>
                {canRespond ? (
                  <button
                    type="button"
                    onClick={() => take(alert)}
                    className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-1.5 font-sans text-sm font-semibold text-text transition-colors hover:border-accent hover:text-accent"
                  >
                    <CheckIcon size={15} />
                    Mark as read
                  </button>
                ) : null}
              </li>
            ))}

            {taken.map(({ alert }) => (
              <li
                key={`taken-${alert.key}`}
                role="status"
                className="flex items-center justify-between gap-3 bg-bg px-5 py-3 text-sm"
              >
                <span className="text-muted">
                  Marked as read: <span className="text-text">{alert.title}</span>
                </span>
                <button
                  type="button"
                  onClick={() => undo(alert)}
                  className="shrink-0 rounded-lg px-2 py-1 font-sans font-semibold text-accent-mid underline-offset-2 hover:underline"
                >
                  Undo
                </button>
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
