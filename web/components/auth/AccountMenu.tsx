"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccess } from "@/components/auth/AccessContext";
import SignOutButton from "@/components/auth/SignOutButton";
import { UserIcon } from "@/components/ui/icons";

/**
 * The profile icon's dropdown. A plain placeholder for testing until the real account menu is designed:
 * who you are and your role, sign in or out, and (only while sign-in is off) "View as" to preview
 * what each role sees. View as sets a cookie the worker ignores once sign-in is on.
 */
export default function AccountMenu({ className }: { className?: string }) {
  const access = useAccess();
  const pathname = usePathname();
  const router = useRouter();
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

  function viewAs(choice: string) {
    document.cookie = `tbd_view_as=${encodeURIComponent(choice)}; path=/; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        className={className}
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <UserIcon />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-1 flex min-w-56 flex-col gap-2 rounded-lg border border-border bg-white p-3 text-left text-sm text-text shadow-md"
        >
          {access === null ? <p>Sample data: the API is not connected.</p> : null}

          {access?.user ? (
            <>
              <p>{access.user.name}</p>
              <p className="text-muted">{access.user.email}</p>
              <p>Role: {access.role}</p>
              <SignOutButton email={access.user.email} />
            </>
          ) : null}

          {access?.authEnabled && !access.user ? (
            <>
              <p>Not signed in (guest view)</p>
              <a href={`/api/auth/google?returnTo=${encodeURIComponent(pathname)}`}>Sign in with Google</a>
            </>
          ) : null}

          {access?.viewAs ? (
            <label className="flex flex-col gap-1">
              <span>View as (testing, sign-in is off)</span>
              <select value={access.role ?? "all"} onChange={(event) => viewAs(event.target.value)}>
                {access.viewAs.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice === "all" ? "everything" : choice}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
