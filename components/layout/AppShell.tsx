"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import NotificationsMenu from "@/components/alerts/NotificationsMenu";
import AccountMenu from "@/components/auth/AccountMenu";
import { dataSections } from "@/components/data/sections";
import DemoControls from "@/components/demo/DemoControls";
import { useDemo } from "@/components/demo/DemoProvider";
import {
  BarsIcon,
  BellIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DropIcon,
  GearIcon,
  GridIcon,
} from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, cx } from "@/components/ui/ui";
import { hoursOfDay } from "@/lib/time";

type PageId = "dashboard" | "stations" | "schedule" | "alerts" | "data" | "settings" | "account";

const navItems: { id: PageId; href: string; label: string; Icon: typeof GridIcon }[] = [
  { id: "dashboard", href: "/", label: "Dashboard", Icon: GridIcon },
  { id: "stations", href: "/stations", label: "Stations", Icon: DropIcon },
  { id: "schedule", href: "/schedule", label: "Schedule", Icon: CalendarIcon },
  { id: "alerts", href: "/alerts", label: "Alerts", Icon: BellIcon },
  { id: "data", href: "/data/overview", label: "Data", Icon: BarsIcon },
  { id: "settings", href: "/settings", label: "Settings", Icon: GearIcon },
];

/** Settings lives behind the gear in the phone header, so it is not in the tab bar. */
const mobileItems = navItems.filter((item) => item.id !== "settings");

/** The component id (lib/rbac.config.ts) that gates the page at `pathname`. */
function gateFor(pathname: string, page: PageId | null): string | null {
  if (page === null) return null;
  if (page === "data") {
    const section = dataSections.find((item) => pathname.startsWith(item.href));
    return section ? `data.${section.id}` : "nav.data";
  }
  return `nav.${page}`;
}

/** Shown in place of a page the current view may not open. */
function NoAccess() {
  const { signedIn, viewAs } = useSession();
  return (
    <div className="px-4 pt-10 md:px-10">
      <Card className="mx-auto max-w-lg py-10 text-center">
        <h1 className="font-sans text-2xl font-bold">
          {signedIn ? "Your role can't open this page" : "Sign in to see this page"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">
          {signedIn
            ? "Ask a manager or the Owner / IT if you need access."
            : "Guests can see today's sap activity and the stations. Members see alerts, data and the schedule."}
        </p>
        {signedIn ? null : (
          <Button className="mt-5" onClick={() => viewAs("member")}>
            Sign In
          </Button>
        )}
      </Card>
    </div>
  );
}

function activePage(pathname: string): PageId | null {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/account")) return "account";
  const match = navItems.find((item) => item.id !== "dashboard" && pathname.startsWith(`/${item.id}`));
  return match?.id ?? null;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = activePage(pathname);
  const { day } = useDemo();
  const { shows } = useSession();
  const { animations } = useClubSettings();
  const [collapsed, setCollapsed] = useState(false);
  const gate = gateFor(pathname, active);
  const allowed = gate === null || shows(gate);
  const visibleNav = navItems.filter((item) => shows(`nav.${item.id}`));
  const visibleMobile = mobileItems.filter((item) => shows(`nav.${item.id}`));

  // The newest reading from any sensor that is still reporting.
  const synced = day.buckets
    .filter((bucket) => bucket.nodeStatus === "online")
    .map((bucket) => bucket.lastUpdated)
    .sort((a, b) => hoursOfDay(b) - hoursOfDay(a))[0];

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text" data-motion={animations ? "on" : "off"}>
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
          {visibleNav.map(({ id, href, label, Icon }) => {
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
                </Link>

                {id === "data" && !collapsed ? (
                  <div className="mt-1 mb-1 ml-8 flex flex-col gap-0.5">
                    {dataSections.filter((section) => shows(`data.${section.id}`)).map((section) => {
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
            <span className="rounded-full bg-season-badge px-4 py-1.5 font-sans text-base font-semibold text-white">
              {day.meta.seasonLabel}
            </span>
            <span className="font-sans text-base text-muted">{day.meta.currentDateLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            {synced ? <span className="text-sm text-muted">Synced {synced}</span> : null}
            {shows("header.alerts") ? <NotificationsMenu /> : null}
            <AccountMenu />
          </div>
        </header>

        <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-1 md:hidden">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-season-badge px-3 py-1 font-sans text-sm font-semibold whitespace-nowrap text-white">
              {day.meta.seasonLabel}
            </span>
            <span className="hidden text-sm whitespace-nowrap text-muted min-[360px]:inline">
              {day.meta.currentDateShortLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {shows("header.alerts") ? <NotificationsMenu /> : null}
            <AccountMenu />
            {shows("nav.settings") ? (
              <Link
                href="/settings"
                aria-label="Settings"
                className={cx("rounded-lg p-1.5", active === "settings" ? "text-accent" : "text-text")}
              >
                <GearIcon size={24} />
              </Link>
            ) : null}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{allowed ? children : <NoAccess />}</main>

        <DemoControls />

        <nav className="fixed right-0 bottom-0 left-0 z-40 flex border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden">
          {visibleMobile.map(({ id, href, label, Icon }) => {
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
                <Icon size={24} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
