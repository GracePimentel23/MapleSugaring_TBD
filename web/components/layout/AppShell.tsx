"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import NotificationsMenu from "@/components/alerts/NotificationsMenu";
import AccountMenu from "@/components/auth/AccountMenu";
import { dataSections } from "@/components/data/sections";
import { useLive } from "@/components/live/LiveProvider";
import {
  BarsIcon,
  BellIcon,
  DropIcon,
  GearIcon,
  GridIcon,
  LeafArrow,
  LeafMark,
  WrenchIcon,
} from "@/components/icons";
import { useClubSettings } from "@/components/session/ClubSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import EmptyingBanner from "@/components/stations/EmptyingBanner";
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

/** The two widths of the side menu: a rail of icons, and open with labels. */
const NAV_RAIL = 76;
const NAV_WIDE = 236;

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
  // The side menu starts as a rail of icons. Hovering opens it over the page; the logo pins it open.
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = pinned || hovered;
  const dataOpen = expanded && active === "data";
  const gate = gateFor(pathname, active);
  const allowed = gate === null || shows(gate);
  const visibleNav = navItems.filter((item) => shows(`nav.${item.id}`));
  const visibleMobile = mobileItems.filter((item) => shows(`nav.${item.id}`));

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      if (window.localStorage.getItem("tbd.navPinned") === "1") setPinned(true);
    } catch {
      // storage blocked: start collapsed
    }
  }, []);

  function togglePinned() {
    const next = !pinned;
    setPinned(next);
    // Collapsing closes it now, even with the pointer still over it.
    if (!next) setHovered(false);
    try {
      window.localStorage.setItem("tbd.navPinned", next ? "1" : "0");
    } catch {
      // not remembered
    }
  }

  // A short delay, so sweeping the pointer past the menu does not open it.
  function hoverOpen() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(true), 120);
  }
  function hoverClose() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(false);
  }

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
      {/* The rail keeps its place in the layout; the panel inside widens over the page on hover. */}
      <div
        className="relative hidden shrink-0 transition-[width] duration-200 md:block"
        style={{ width: pinned ? NAV_WIDE : NAV_RAIL }}
      >
        <aside
          aria-label="Main"
          onMouseEnter={hoverOpen}
          onMouseLeave={hoverClose}
          onFocus={() => setHovered(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
          }}
          className={cx(
            "absolute inset-y-0 left-0 z-40 flex flex-col overflow-x-hidden overflow-y-auto bg-sidebar text-white transition-[width,box-shadow] duration-200",
            expanded && !pinned && "shadow-[8px_0_32px_rgb(0_0_0/0.18)]",
          )}
          style={{ width: expanded ? NAV_WIDE : NAV_RAIL }}
        >
          {/* Same height as the page header, so the logo and the header line up. */}
          <div className="flex h-[76px] shrink-0 items-center px-3">
            <button
              type="button"
              onClick={togglePinned}
              aria-label={pinned ? "Collapse the menu" : "Keep the menu open"}
              aria-pressed={pinned}
              title={pinned ? "Collapse the menu" : "Keep the menu open"}
              className="flex min-w-0 items-center gap-2 rounded-xl py-1.5 pr-3 transition-colors hover:bg-white/10"
            >
              <span className="flex w-[52px] shrink-0 justify-center">
                <LeafMark size={30} />
              </span>
              <span
                className={cx(
                  "font-sans text-[19px] leading-tight font-bold whitespace-nowrap transition-opacity duration-150",
                  expanded ? "opacity-100" : "opacity-0",
                )}
              >
                Maple Sugaring
              </span>
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 pt-2 pb-6">
            {visibleNav.map(({ id, href, label, Icon }) => {
              const isActive = active === id;
              return (
                <div key={id}>
                  <Link
                    href={href}
                    title={expanded ? undefined : label}
                    aria-current={isActive ? "page" : undefined}
                    className={cx(
                      "relative flex h-11 items-center gap-3 rounded-xl px-4 font-sans text-body whitespace-nowrap transition-colors",
                      isActive
                        ? "bg-sidebar-active font-semibold text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span className={cx("flex-1 transition-opacity duration-150", expanded ? "opacity-100" : "opacity-0")}>
                      {label}
                    </span>
                    {isActive && expanded && !(id === "data" && dataOpen) ? <LeafArrow /> : null}
                  </Link>

                  {id === "data" && dataOpen ? (
                    // A thin stem from the Data icon; the open page hangs a leaf on it.
                    <div className="relative mt-1 mb-1 ml-[27px] flex flex-col border-l border-white/20 py-0.5">
                      {dataSections
                        .filter((section) => shows(`data.${section.id}`))
                        .map((section) => {
                          const sectionActive = pathname === section.href;
                          return (
                            <Link
                              key={section.id}
                              href={section.href}
                              aria-current={sectionActive ? "page" : undefined}
                              className={cx(
                                "relative flex items-center rounded-r-xl py-2 pr-3 pl-6 font-sans text-sm whitespace-nowrap transition-colors",
                                sectionActive
                                  ? "font-semibold text-white"
                                  : "text-white/70 hover:bg-white/5 hover:text-white",
                              )}
                            >
                              {sectionActive ? (
                                <span className="absolute top-1/2 -left-[8px] -translate-y-1/2 text-[#A9D18E]">
                                  <LeafArrow size={15} />
                                </span>
                              ) : null}
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
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="hidden h-[76px] shrink-0 items-center justify-between px-6 md:flex lg:px-10">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-season-badge px-3 py-1 font-sans text-sm font-semibold text-white">
              {day.meta.seasonLabel}
            </span>
            <span className="text-sm text-muted">{day.meta.currentDateLabel}</span>
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
          {/* A bucket being emptied shows on every page, with its countdown and Resume Alerts. */}
          {allowed ? <EmptyingBanner /> : null}
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
