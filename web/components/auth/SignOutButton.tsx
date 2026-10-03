"use client";

import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/api/client";

/** Placeholder sign-out control; unstyled on purpose. */
export default function SignOutButton({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    await sendJson("POST", "/auth/logout").catch(() => {});
    // Re-render the server components without the cookie: the page falls back to the guest view.
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} title={email} className="text-sm">
      Sign out
    </button>
  );
}
