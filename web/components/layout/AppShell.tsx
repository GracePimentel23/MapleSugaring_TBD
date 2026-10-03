"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ShowFor, shows, useAccess } from "@/components/auth/AccessContext";
import AccountMenu from "@/components/auth/AccountMenu";
import AuthError from "@/components/auth/AuthError";
import {
  BellIcon,
  DashboardIcon,
  DataIcon,
  MapleLeafLogo,
  MobileNavIcon,
  SettingsIcon,
  StationsIcon,
} from "@/components/ui/icons";

type PageId = "dashboard" | "stations" | "data";

const navItems: {
  id: PageId;
  href: string;
  label: string;
  Icon: typeof DashboardIcon;
}[] = [
  { id: "dashboard", href: "/", label: "Dashboard", Icon: DashboardIcon },
  { id: "stations", href: "/stations", label: "Stations", Icon: StationsIcon },
  { id: "data", href: "/data", label: "Data", Icon: DataIcon },
];

function activePage(pathname: string): PageId {
  if (pathname.startsWith("/stations")) return "stations";
  if (pathname.startsWith("/data")) return "data";
  return "dashboard";
}

export interface ShellInfo {
  seasonLabel: string;
  currentDateLabel: string;
  currentDateShortLabel: string;
  hasUnreadAlerts: boolean;
}

export default function AppShell({
  children,
  shell,
}: {
  children: ReactNode;
  shell: ShellInfo;
}) {
  const pathname = usePathname();
  const active = activePage(pathname);
  const { hasUnreadAlerts } = shell;
  // Nav links each role may see: "nav.<id>" in worker/src/rbac.config.js.
  const access = useAccess();
  const visibleNavItems = navItems.filter((item) => shows(access, `nav.${item.id}`));

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <aside className="hidden w-[220px] shrink-0 flex-col bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
          <MapleLeafLogo />
          <span className="font-sans text-base font-semibold text-white">& Title</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {visibleNavItems.map(({ id, href, label, Icon }) => {
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={href}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                style={{
                  background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                }}
              >
                <Icon active={isActive} />
                <span className="font-sans text-sm font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <ShowFor id="nav.settings">
          <div className="border-t border-white/10 px-3 py-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/10"
            >
              <SettingsIcon />
              <span className="font-sans text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                Settings
              </span>
            </button>
          </div>
        </ShowFor>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="hidden items-center justify-between border-b border-border bg-bg px-6 py-3.5 md:flex">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-season-badge px-3 py-1 font-sans text-sm font-medium text-white">
              {shell.seasonLabel}
            </span>
            <span className="text-sm text-muted">{shell.currentDateLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <button
              type="button"
              className="relative rounded-lg p-1.5 transition-colors hover:bg-black/5"
              aria-label="Notifications"
            >
              <BellIcon />
              {hasUnreadAlerts ? (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              ) : null}
            </button>
            <AccountMenu className="rounded-lg p-1.5 transition-colors hover:bg-black/5" />
          </div>
        </header>

        <header className="flex items-center justify-between border-b border-border bg-bg px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-sidebar">
              <MapleLeafLogo size={22} />
            </div>
            <span className="rounded-full bg-season-badge px-2 py-0.5 text-xs font-medium text-white">
              {shell.seasonLabel}
            </span>
            <span className="text-xs text-muted">{shell.currentDateShortLabel}</span>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <button type="button" className="relative p-1.5" aria-label="Notifications">
              <BellIcon />
              {hasUnreadAlerts ? (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
              ) : null}
            </button>
            <AccountMenu className="p-1.5" />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          <AuthError />
          {children}
        </main>

        <nav className="fixed right-0 bottom-0 left-0 z-40 flex border-t border-border bg-white md:hidden">
          {visibleNavItems.map(({ id, href, label }) => {
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
