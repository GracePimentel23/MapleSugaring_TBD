"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BellIcon,
  DashboardIcon,
  DataIcon,
  MapleLeafLogo,
  MobileNavIcon,
  SettingsIcon,
  StationsIcon,
  UserIcon,
} from "@/components/icons";
import { alerts, dashboardMeta } from "@/lib/data/mock";

type PageId = "dashboard" | "stations" | "data";

const navItems: { id: PageId; href: string; label: string; Icon: typeof DashboardIcon }[] = [
  { id: "dashboard", href: "/", label: "Dashboard", Icon: DashboardIcon },
  { id: "stations", href: "/stations", label: "Stations", Icon: StationsIcon },
  { id: "data", href: "/data", label: "Data", Icon: DataIcon },
];

function activePage(pathname: string): PageId {
  if (pathname.startsWith("/stations")) return "stations";
  if (pathname.startsWith("/data")) return "data";
  return "dashboard";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = activePage(pathname);
  const hasUnreadAlerts =
    alerts.some((alert) => !alert.is_resolved) || Boolean(dashboardMeta.weatherAlert);

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <aside className="hidden w-[200px] shrink-0 flex-col md:flex bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <MapleLeafLogo />
          <span className="font-sans text-base font-semibold text-white">& Title</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {navItems.map(({ id, href, label, Icon }) => {
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={href}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                style={{
                  background: isActive ? "rgba(255,255,255,0.16)" : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.62)",
                }}
              >
                <Icon active={isActive} />
                <span className="font-sans text-sm font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-5">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="hidden items-center justify-between border-b border-border px-6 py-3.5 md:flex bg-bg">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-season-badge px-3 py-1 font-sans text-sm font-medium text-white">
              {dashboardMeta.seasonLabel}
            </span>
            <span className="text-sm text-muted">{dashboardMeta.currentDateLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <button
              type="button"
              className="relative rounded-lg p-1.5 transition-colors hover:bg-black/5"
              aria-label="Notifications"
            >
              <BellIcon />
              {hasUnreadAlerts ? (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-status-attention" />
              ) : null}
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
              aria-label="Account"
            >
              <UserIcon />
            </button>
          </div>
        </header>

        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden bg-bg">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-sidebar">
              <MapleLeafLogo size={22} />
            </div>
            <span className="rounded-full bg-season-badge px-2 py-0.5 text-xs font-medium text-white">
              {dashboardMeta.seasonLabel}
            </span>
            <span className="text-xs text-muted">{dashboardMeta.currentDateShortLabel}</span>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <button type="button" className="relative p-1.5" aria-label="Notifications">
              <BellIcon />
              {hasUnreadAlerts ? (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-status-attention" />
              ) : null}
            </button>
            <button type="button" className="p-1.5" aria-label="Account">
              <UserIcon />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>

        <nav className="fixed right-0 bottom-0 left-0 flex border-t border-border bg-white md:hidden">
          {navItems.map(({ id, href, label }) => {
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={href}
                className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium"
                style={{
                  color: isActive ? "var(--color-accent)" : "var(--color-muted)",
                  fontFamily: "var(--font-dm-sans), sans-serif",
                }}
              >
                <MobileNavIcon id={id} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
