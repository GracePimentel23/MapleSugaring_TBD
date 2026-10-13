"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { dataSections } from "@/components/data/sections";
import DemoControls from "@/components/demo/DemoControls";
import { useDemo } from "@/components/demo/DemoProvider";
import {
  BarsIcon,
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DropIcon,
  GearIcon,
  GridIcon,
} from "@/components/icons";
import { useAlerts } from "@/components/stations/StationStateProvider";
import { cx } from "@/components/ui/ui";
import { hoursOfDay } from "@/lib/time";

type PageId = "dashboard" | "stations" | "alerts" | "data" | "settings";

const navItems: { id: PageId; href: string; label: string; Icon: typeof GridIcon }[] = [
  { id: "dashboard", href: "/", label: "Dashboard", Icon: GridIcon },
  { id: "stations", href: "/stations", label: "Stations", Icon: DropIcon },
  { id: "alerts", href: "/alerts", label: "Alerts", Icon: BellIcon },
  { id: "data", href: "/data/overview", label: "Data", Icon: BarsIcon },
  { id: "settings", href: "/settings", label: "Settings", Icon: GearIcon },
];

/** Settings lives behind the gear in the phone header, so the tab bar has four. */
const mobileItems = navItems.filter((item) => item.id !== "settings");

function activePage(pathname: string): PageId | null {
  if (pathname === "/") return "dashboard";
  const match = navItems.find((item) => item.id !== "dashboard" && pathname.startsWith(`/${item.id}`));
  return match?.id ?? null;
}

function AlertBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count === 0) return null;
  if (collapsed) {
    return <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-status-problem" />;
  }
  return (
    <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-status-problem px-1.5 text-xs font-bold text-white">
      {count}
    </span>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = activePage(pathname);
  const { day } = useDemo();
  const { active: activeAlerts } = useAlerts();
  const [collapsed, setCollapsed] = useState(false);

  // The newest reading from any sensor that is still reporting.
  const synced = day.buckets
    .filter((bucket) => bucket.nodeStatus === "online")
    .map((bucket) => bucket.lastUpdated)
    .sort((a, b) => hoursOfDay(b) - hoursOfDay(a))[0];

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <aside
        className={cx(
          "hidden shrink-0 flex-col bg-sidebar text-white transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-[220px]",
        )}
      >
        <div
          className={cx(
            "flex items-center pt-6 pb-6",
            collapsed ? "justify-center px-2" : "justify-between pr-3 pl-5",
          )}
        >
          {collapsed ? null : <span className="font-sans text-xl font-bold">&amp; Title</span>}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <ChevronRightIcon size={18} /> : <ChevronLeftIcon size={18} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map(({ id, href, label, Icon }) => {
            const isActive = active === id;
            return (
              <div key={id}>
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cx(
                    "relative flex items-center gap-3 rounded-xl font-sans text-[15px] transition-colors",
                    collapsed ? "justify-center p-3" : "px-3 py-2.5",
                    isActive
                      ? "bg-sidebar-active font-semibold text-white"
                      : "text-white/85 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon size={20} />
                  {collapsed ? null : <span>{label}</span>}
                  {id === "alerts" ? (
                    <AlertBadge count={activeAlerts.length} collapsed={collapsed} />
                  ) : null}
                </Link>

                {id === "data" && !collapsed ? (
                  <div className="mt-1 mb-1 ml-8 flex flex-col gap-0.5">
                    {dataSections.map((section) => {
                      const sectionActive = pathname === section.href;
                      return (
                        <Link
                          key={section.id}
                          href={section.href}
                          className={cx(
                            "rounded-xl px-3 py-2 font-sans text-sm transition-colors",
                            sectionActive
                              ? "bg-sidebar-active font-semibold text-white"
                              : "text-white/80 hover:bg-white/10 hover:text-white",
                          )}
                        >
                          {section.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="hidden items-center justify-between px-6 pt-5 pb-2 md:flex lg:px-10">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-season-badge px-3.5 py-1 font-sans text-sm font-semibold text-white">
              {day.meta.seasonLabel}
            </span>
            <span className="text-sm text-muted">{day.meta.currentDateLabel}</span>
          </div>
          {synced ? <span className="text-sm text-muted">Synced {synced}</span> : null}
        </header>

        <header className="flex items-center justify-between px-4 pt-4 pb-1 md:hidden">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-season-badge px-2.5 py-0.5 font-sans text-xs font-semibold text-white">
              {day.meta.seasonLabel}
            </span>
            <span className="text-xs text-muted">{day.meta.currentDateShortLabel}</span>
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            className={cx(
              "rounded-lg p-1.5",
              active === "settings" ? "text-accent" : "text-text",
            )}
          >
            <GearIcon size={24} />
          </Link>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

        <DemoControls />

        <nav className="fixed right-0 bottom-0 left-0 z-40 flex border-t border-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {mobileItems.map(({ id, href, label, Icon }) => {
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={href}
                className={cx(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 font-sans text-xs",
                  isActive ? "font-semibold text-accent" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon size={24} />
                  {id === "alerts" && activeAlerts.length > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-status-problem px-1 text-[10px] font-bold text-white">
                      {activeAlerts.length}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
