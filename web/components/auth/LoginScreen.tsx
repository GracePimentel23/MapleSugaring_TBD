"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Placeholder sign-in screen: deliberately plain so the designers can restyle it.

const ERRORS: Record<string, string> = {
  domain_not_allowed: "That Google account isn't allowed. Sign in with your RIT Google account.",
  email_not_verified: "That Google account's email address isn't verified.",
  account_mismatch: "That email address is linked to a different Google account. Ask an admin.",
  cancelled: "Sign-in was cancelled.",
  expired: "Sign-in took too long or was started in another tab. Try again.",
};

function AuthError() {
  const code = useSearchParams().get("auth_error");
  if (!code) return null;
  return <p role="alert">{ERRORS[code] ?? "Sign-in failed. Try again."}</p>;
}

export default function LoginScreen() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Maple Sugaring</h1>
      <Suspense fallback={null}>
        <AuthError />
      </Suspense>
      {/* A full-page GET: the worker redirects to Google and back, so there is no client-side OAuth code. */}
      <form action="/api/auth/google" method="get">
        <button type="submit">Sign in with Google</button>
      </form>
    </main>
  );
}
