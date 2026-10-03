"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Why a sign-in failed (?auth_error=... from the worker). Unstyled on purpose so the designers can restyle it.

const ERRORS: Record<string, string> = {
  domain_not_allowed: "That Google account isn't allowed. Sign in with your RIT Google account.",
  email_not_verified: "That Google account's email address isn't verified.",
  account_mismatch: "That email address is linked to a different Google account. Ask an owner.",
  cancelled: "Sign-in was cancelled.",
  expired: "Sign-in took too long or was started in another tab. Try again.",
};

function Message() {
  const code = useSearchParams().get("auth_error");
  if (!code) return null;
  return <p role="alert">{ERRORS[code] ?? "Sign-in failed. Try again."}</p>;
}

export default function AuthError() {
  return (
    <Suspense fallback={null}>
      <Message />
    </Suspense>
  );
}
