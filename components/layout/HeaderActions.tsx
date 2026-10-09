"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import {
  BellIcon,
  NotificationIcon,
  SettingsIcon,
  SignOutIcon,
  UserIcon,
  type NotificationKind,
} from "@/components/icons";
import { useStationCards, useStationState } from "@/components/stations/StationStateProvider";
import { currentUser } from "@/lib/data/stationNotes";
import { alertHeadline } from "@/lib/selectors/stations";

interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  time: string;
  urgent: boolean;
  /** Station to jump to when clicked; weather notices have none */
  bucketId: number | null;
}

function alertKind(alertType: string): NotificationKind {
  if (alertType === "low_battery") return "battery";
  if (alertType === "high_fill") return "full";
  return "offline";
}

/** "2026-03-06T06:02:00-05:00" -> "6:02 AM" */
function formatAlertTime(createdAt: string): string {
  const [hours, minutes] = (createdAt.split("T")[1] ?? "00:00").split(":").map(Number);
  const suffix = hours! >= 12 ? "PM" : "AM";
  const hour12 = hours! % 12 === 0 ? 12 : hours! % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function useNotifications(): Notification[] {
  const { day } = useDemo();
  const stations = useStationCards();
  const { maintenanceEvents } = useStationState();

  const stationNotifications: Notification[] = day.alerts
    .filter((alert) => !alert.is_resolved)
    .flatMap((alert) => {
      const station = stations.find((item) => item.nodeId === alert.node_id);
      if (!station) return [];
      return [
        {
          id: `alert-${alert.id}`,
          kind: alertKind(alert.alert_type),
          title: alertHeadline(alert, station.name),
          detail: alert.message,
          time: formatAlertTime(alert.created_at),
          urgent: alert.severity === "critical",
          bucketId: station.bucketId,
        },
      ];
    })
    // Hardware problems first, then the rest by bucket
    .sort((a, b) => Number(b.urgent) - Number(a.urgent));

  // Maintenance changes made this session, newest first, ahead of the alerts.
  const maintenanceNotifications: Notification[] = maintenanceEvents.flatMap((event) => {
    const station = stations.find((item) => item.bucketId === event.bucketId);
    if (!station) return [];
    return [
      {
        id: `maintenance-${event.id}`,
        kind: event.entering ? "maintenance" : "back-online",
        title: event.entering
          ? `${station.name} put in maintenance`
          : `${station.name} is out of maintenance`,
        detail: event.entering
          ? `${event.by} switched this station to maintenance mode.`
          : `${event.by} switched this station back on.`,
        time: event.time,
        urgent: false,
        bucketId: station.bucketId,
      },
    ];
  });
  stationNotifications.unshift(...maintenanceNotifications);

  if (day.meta.weatherAlert) {
    stationNotifications.unshift({
      id: "weather",
      kind: "weather",
      title: day.meta.weatherAlert.message,
      detail: day.meta.sapCondition.headline,
      time: "Today",
      urgent: true,
      bucketId: null,
    });
  }

  return stationNotifications;
}

type OpenMenu = "notifications" | "profile" | null;

export default function HeaderActions() {
  const router = useRouter();
  const { focusStation } = useStationState();
  const notifications = useNotifications();
  const [open, setOpen] = useState<OpenMenu>(null);

  const stationAlertCount = notifications.filter(
    (item) => item.kind === "battery" || item.kind === "full" || item.kind === "offline",
  ).length;

  function toggle(menu: Exclude<OpenMenu, null>) {
    setOpen((current) => (current === menu ? null : menu));
  }

  function openNotification(item: Notification) {
    setOpen(null);
    if (item.bucketId === null) {
      router.push("/");
      return;
    }
    focusStation(item.bucketId);
    router.push("/stations");
  }

  return (
    <div className="relative flex items-center gap-1 text-muted md:gap-2">
      <button
        type="button"
        onClick={() => toggle("notifications")}
        className="relative rounded-lg p-1.5 transition-colors hover:bg-black/5"
        aria-label="Notifications"
        aria-expanded={open === "notifications"}
      >
        <BellIcon />
        {notifications.length > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {notifications.length}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => toggle("profile")}
        className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
        aria-label="Account"
        aria-expanded={open === "profile"}
      >
        <UserIcon />
      </button>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default"
          aria-label="Close menu"
          onClick={() => setOpen(null)}
        />
      ) : null}

      {open === "notifications" ? (
        <div
          className="fixed top-14 right-3 left-3 z-40 overflow-hidden rounded-2xl border border-border bg-white text-text shadow-xl md:absolute md:top-10 md:right-10 md:left-auto md:w-80"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="font-sans text-sm font-semibold">Notifications</p>
            <p className="mt-0.5 text-xs text-muted">
              {notifications.length} notification{notifications.length === 1 ? "" : "s"}
              {" · "}
              {stationAlertCount === 0
                ? "all stations healthy"
                : `${stationAlertCount} station alert${stationAlertCount === 1 ? "" : "s"}`}
            </p>
          </div>
          {/* Fixed max height so a long list scrolls inside the card */}
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">
                You&apos;re all caught up.
              </p>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className="flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-bg"
                >
                  <NotificationIcon kind={item.kind} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">
                      {item.detail}
                    </span>
                    <span className="mt-1.5 block text-[10px] text-muted">
                      {item.time}
                      {item.bucketId !== null ? " · View station" : ""}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {open === "profile" ? (
        <div className="absolute top-10 right-0 z-40 w-52 rounded-2xl border border-border bg-white p-2 text-text shadow-xl">
          <div className="mb-1 border-b border-border px-3 py-2">
            <p className="font-sans text-sm font-semibold">{currentUser.name}</p>
            <p className="text-xs text-muted">{currentUser.roleLabel}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(null)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-bg"
          >
            <SettingsIcon size={16} />
            Settings
          </Link>
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-bg"
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
