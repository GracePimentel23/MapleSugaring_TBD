"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import NotificationsMenu from "@/components/alerts/NotificationsMenu";
import AccountMenu from "@/components/auth/AccountMenu";
import { dataSections } from "@/components/data/sections";
import { useLive } from "@/components/live/LiveProvider";
import {
  BarsIcon,
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DropIcon,
  GearIcon,
  GridIcon,
  LeafMark,
  WrenchIcon,
} from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, cx } from "@/components/ui/ui";

type PageId = "dashboard" | "stations" | "alerts" | "data" | "settings" | "account" | "demo";

const navItems: { id: PageId; href: string; label: string; Icon: typeof GridIcon }[] = [
  { id: "dashboard", href: "/", label: "Dashboard", Icon: GridIcon },
  { id: "stations", href: "/stations", label: "Stations", Icon: DropIcon },
  { id: "alerts", href: "/alerts", label: "Alerts", Icon: BellIcon },
  { id: "data", href: "/data/overview", label: "Data", Icon: BarsIcon },
  { id: "settings", href: "/settings", label: "Settings", Icon: GearIcon },
  // Temporary: load cell bench tools (tare, modes, calibration) for the sponsor video.
  { id: "demo", href: "/demo", label: "Demo", Icon: WrenchIcon },
];

/**
 * On phones, Settings lives in the profile menu and alerts live behind the bell (its panel links
 * to the Alerts page), and Demo is desktop only, so none of them is in the tab bar.
 */
const mobileItems = navItems.filter((item) => item.id !== "settings" && item.id !== "alerts" && item.id !== "demo");

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
  const { signedIn } = useSession();
  const router = useRouter();
  return (
    <div className="px-4 pt-10 md:px-10">
      <Card className="mx-auto max-w-lg py-10 text-center">
        <h1 className="font-sans text-2xl font-bold">
          {signedIn ? "Your role can't open this page" : "Sign in to see this page"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">
          {signedIn
            ? "Ask a manager or the Owner / IT if you need access."
            : "Guests can see today's sap activity and the stations. Members see alerts and data."}
        </p>
        {signedIn ? null : (
          <Button className="mt-5" onClick={() => router.push("/login")}>
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
  const router = useRouter();
  const active = activePage(pathname);
  const { day, source } = useLive();
  const { shows } = useSession();
  const { animations } = useClubSettings();
  const [collapsed, setCollapsed] = useState(false);
  const gate = gateFor(pathname, active);
  const allowed = gate === null || shows(gate);
  const visibleNav = navItems.filter((item) => shows(`nav.${item.id}`));
  const visibleMobile = mobileItems.filter((item) => shows(`nav.${item.id}`));

  // A failed sign-in comes back from the worker as /?auth_error=...; show it on the login page.
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("auth_error");
    if (error && pathname !== "/login") router.replace(`/login?auth_error=${encodeURIComponent(error)}`);
  }, [pathname, router]);

  // The sign-in page stands on its own, without the app's navigation.
  if (pathname === "/login") {
    return (
      <div className="h-screen overflow-y-auto" data-motion={animations ? "on" : "off"}>
        {children}
      </div>
    );
  }

  // The newest reading from any sensor.
  const newest = day.buckets
    .filter((bucket) => bucket.updatedAt)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
  const synced = newest?.lastUpdated;

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text" data-motion={animations ? "on" : "off"}>
      <aside
        className={cx(
          "hidden shrink-0 flex-col bg-sidebar text-white transition-[width] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-[220px]",
        )}
      >
        <div
          className={cx("flex items-center pt-6 pb-6", collapsed ? "justify-center px-2" : "justify-between pr-3 pl-5")}
        >
          {collapsed ? null : (
            <span className="flex items-center gap-2.5 font-sans text-xl leading-tight font-bold">
              <LeafMark size={28} className="shrink-0" />
              Maple Sugaring
            </span>
          )}
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
                    "relative flex items-center gap-3 rounded-xl font-sans text-body transition-colors",
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
                    {dataSections
                      .filter((section) => shows(`data.${section.id}`))
                      .map((section) => {
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

        <header className="flex items-center justify-between gap-2 bg-sidebar px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white md:hidden">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 font-sans text-sm font-semibold whitespace-nowrap text-accent">
              {day.meta.seasonLabel}
            </span>
            <span className="hidden text-sm whitespace-nowrap text-white min-[360px]:inline">
              {day.meta.currentDateShortLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {shows("header.alerts") ? <NotificationsMenu onDark /> : null}
            <AccountMenu onDark />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          {source === "offline" ? (
            <div className="mx-4 mb-2 rounded-xl border border-attention-border bg-attention-bg px-4 py-2.5 text-sm md:mx-6 lg:mx-10">
              The API is not connected, so there is no station data to show. Check that the worker is running.
            </div>
          ) : null}
          {allowed ? children : <NoAccess />}
        </main>

        <nav className="fixed right-0 bottom-0 left-0 z-40 flex bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
          {visibleMobile.map(({ id, href, label, Icon }) => {
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={href}
                className={cx(
                  "flex flex-1 flex-col items-center gap-1.5 pt-3.5 pb-4 font-sans text-xs",
                  isActive ? "font-bold text-white" : "font-normal text-white/50",
                )}
              >
                <Icon size={24} strokeWidth={isActive ? 2.3 : 1.3} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
