"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, LEAF_PATH, LockIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { Button, cx } from "@/components/ui/ui";

/** Why the worker sent someone back without signing them in (worker/src/auth.js). */
const AUTH_ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  expired: "That sign-in took too long. Try again.",
  google_error: "Google could not confirm your account. Try again.",
  domain_not_allowed: "Use your RIT account (@g.rit.edu). Personal Google accounts can't sign in.",
  email_not_verified: "Your Google account's email isn't verified.",
  no_email: "Your Google account has no email address.",
  account_mismatch: "That email is linked to a different Google account. Ask the Owner / IT for help.",
};

const noSubscribe = () => () => {};
/** ?auth_error=... from the address bar; null while rendering on the server. */
function useAuthError(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("auth_error"),
    () => null,
  );
}

function initials(name: string): string {
  return name
    .replace(/\./g, "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Sign in. With the worker's sign-in on, "Sign in with RIT SSO" goes to RIT's Google sign-in
 * (/api/auth/google) and comes back signed in. Without it (AUTH_PROVIDER unset) the same button
 * opens a picker with one test view per role ("View as"), when the worker offers it.
 */
export default function LoginPage() {
  const { enterAs, viewChoices, viewLabels, viewDescriptions, authMode, startSignIn } = useSession();
  const [step, setStep] = useState<"start" | "choose">("start");
  const errorCode = useAuthError();
  const error = errorCode ? (AUTH_ERRORS[errorCode] ?? "Sign-in didn't work. Try again.") : null;

  // Every view the worker lets you preview except signed out (that is "Continue as Guest").
  const accounts = (viewChoices ?? []).filter((view) => view !== "guest");

  // A full page load (in enterAs): the role lives in a cookie the server reads, and a client-side
  // push would show the page as it was rendered for the previous role.
  function enter(view: string) {
    void enterAs(view);
  }

  function signIn() {
    if (authMode === "sso") startSignIn("/");
    else setStep("choose");
  }

  return (
    <div className="flex min-h-full flex-col bg-bg md:flex-row">
      <section className="relative flex shrink-0 flex-col justify-end overflow-hidden bg-sidebar px-6 pt-14 pb-8 text-white md:w-[44%] md:justify-center md:px-14">
        <svg
          viewBox="0 0 100 110"
          aria-hidden="true"
          className="anim-sway pointer-events-none absolute -top-10 -right-16 h-72 w-72 fill-white/10 md:top-auto md:-right-24 md:-bottom-16 md:h-[420px] md:w-[420px]"
        >
          <path d={LEAF_PATH} />
        </svg>
        <p className="relative font-sans text-sm font-semibold tracking-widest text-white/70 uppercase">
          Sugarbush Club
        </p>
        <h1 className="relative mt-2 font-sans text-4xl font-bold md:text-5xl">Maple Sugaring</h1>
        <p className="relative mt-3 max-w-sm text-base text-white/85 md:text-lg">
          Live sap levels, alerts and boiling batches for every bucket in the grove.
        </p>
      </section>

      <section className="flex flex-1 items-start justify-center px-4 py-8 md:items-center md:px-10">
        <div className="w-full max-w-md rounded-3xl border border-border bg-white p-6 shadow-sm md:p-8">
          {step === "start" ? (
            <>
              <h2 className="font-sans text-2xl font-bold">Sign in</h2>
              <p className="mt-1 text-muted">
                Use your school account to log collections, handle alerts and see the data.
              </p>

              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-attention-border bg-attention-bg px-4 py-3 text-sm text-status-problem"
                >
                  {error}
                </p>
              ) : null}

              <Button className="mt-6 w-full py-3 text-base" onClick={signIn}>
                <LockIcon size={18} />
                Sign in with RIT SSO
              </Button>

              <div className="my-5 flex items-center gap-3 text-sm text-muted">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="outline"
                className="w-full border-border py-3 text-base text-text"
                onClick={() => enter("guest")}
              >
                Continue as Guest
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("start")}
                className="-ml-1 mb-3 flex items-center gap-1 rounded-lg px-1 py-0.5 font-sans text-sm font-semibold text-muted hover:text-text"
              >
                <ChevronLeftIcon size={16} />
                Back
              </button>
              <h2 className="font-sans text-2xl font-bold">Choose an account</h2>
              <p className="mt-1 text-muted">Each account opens the app with that role&apos;s view.</p>

              <ul className="mt-5 space-y-2">
                {accounts.map((role) => (
                  <li key={role}>
                    <button
                      type="button"
                      onClick={() => enter(role)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent-light"
                    >
                      <span
                        className={cx(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-sans text-sm font-bold text-white",
                          role === "owner" ? "bg-slate" : role === "manager" ? "bg-accent" : "bg-accent-mid",
                        )}
                      >
                        {initials(viewLabels[role] ?? role)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-sans text-base font-semibold">{viewLabels[role] ?? role}</span>
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">{viewDescriptions[role]}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-xl bg-bg px-4 py-3 text-sm text-muted">
                {accounts.length
                  ? "Test mode: sign-in is off on this server, so pick a view. Once the worker's sign-in is on, this button goes to RIT's Google sign-in instead."
                  : "Sign-in is off on this server and it offers no test views, so everyone sees the guest view."}
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
