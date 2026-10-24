"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GearIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { Button, cx } from "@/components/ui/ui";
import { VIEWS, viewDescriptions, viewLabels } from "@/lib/rbac";
import type { View } from "@/lib/rbac.config";

function ProfileIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="10" cy="7" r="3.4" />
      <path d="M3.5 17c0-3.3 2.9-5.8 6.5-5.8s6.5 2.5 6.5 5.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The profile icon's menu, ported from web/components/auth/AccountMenu.tsx on main: who you are
 * and your role, sign in or out, and "View as" to act as each role. Sign In opens /login; with
 * real sign-in on (the worker's Google sign-in), "View as" is hidden and the role is the worker's.
 */
export default function AccountMenu({ onDark = false }: { onDark?: boolean }) {
  const router = useRouter();
  const { view, signedIn, user, viewAs, shows, authMode, signOut } = useSession();
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
        aria-label={`Account: ${signedIn ? user.name : "Guest"}, ${viewLabels[view]}`}
        title={`${signedIn ? user.name : "Guest"} · ${viewLabels[view]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          "flex items-center rounded-full p-1 font-sans text-sm transition-opacity hover:opacity-85",
          !signedIn && "text-muted",
        )}
      >
        <span
          className={cx(
            "flex h-8 w-8 items-center justify-center rounded-full",
            onDark
              ? signedIn
                ? "bg-white text-accent"
                : "bg-white/15 text-white"
              : signedIn
                ? "bg-accent text-white"
                : "bg-bg text-muted",
          )}
        >
          <ProfileIcon />
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl border border-border bg-white p-4 text-left text-sm text-text shadow-xl"
        >
          {signedIn ? (
            <>
              <p className="font-sans text-base font-semibold">
                {user.name}
                {user.pronouns ? (
                  <span className="ml-1.5 text-sm font-normal text-muted">({user.pronouns})</span>
                ) : null}
              </p>
              <p className="text-muted">{user.email}</p>
              <p className="mt-1">
                Role: <span className="font-semibold">{viewLabels[view]}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-accent px-3 py-1.5 text-center font-sans text-sm font-semibold text-white hover:bg-sidebar-hover"
                >
                  Edit Account
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-border text-text"
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                    router.push("/login");
                  }}
                >
                  Sign Out
                </Button>
              </div>
              {shows("nav.settings") ? (
                // Phones have no sidebar, so Settings lives here.
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 font-sans font-semibold hover:bg-bg md:hidden"
                >
                  <GearIcon size={18} />
                  Settings
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <p className="font-sans text-base font-semibold">Not signed in</p>
              <p className="text-muted">Guest view: today&apos;s sap activity only.</p>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => {
                  setOpen(false);
                  router.push("/login");
                }}
              >
                Sign In
              </Button>
            </>
          )}

          {authMode === "sso" ? null : (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">View as (testing)</p>
              <div className="space-y-1">
                {VIEWS.map((choice: View) => (
                  <button
                    key={choice}
                    type="button"
                    role="menuitemradio"
                    aria-checked={view === choice}
                    onClick={() => viewAs(choice)}
                    className={cx(
                      "w-full rounded-xl px-3 py-2 text-left transition-colors",
                      view === choice ? "bg-accent-light" : "hover:bg-bg",
                    )}
                  >
                    <span className="block font-semibold">{viewLabels[choice]}</span>
                    <span className="block text-xs text-muted">{viewDescriptions[choice]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
