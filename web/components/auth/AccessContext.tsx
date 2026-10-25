"use client";

import type { ReactNode } from "react";
import { useSession } from "@/components/session/SessionProvider";

/**
 * Show or hide parts of the UI by role. Who sees what is decided in worker/src/rbac.config.js
 * (see docs/RBAC.md); the answer comes from GET /api/auth/me through the session.
 *
 *   <ShowFor id="dashboard.nextSteps"><NextSteps ... /></ShowFor>
 *   const canLog = useCan("collections:log");
 *
 * Hiding is cosmetic: the worker refuses the action anyway if the role lacks the permission.
 */

/** Who is looking and what they hold. */
export function useAccess() {
  const { view, user, signedIn, grants } = useSession();
  return { role: view, user: signedIn ? user : null, permissions: grants[view] ?? [] };
}

export function useCan(permission: string): boolean {
  return useSession().can(permission);
}

export function useShows(id: string): boolean {
  return useSession().shows(id);
}

/** Renders children only for views that may see component `id`; otherwise `fallback` (default nothing). */
export function ShowFor({ id, fallback = null, children }: { id: string; fallback?: ReactNode; children: ReactNode }) {
  return useShows(id) ? children : fallback;
}

/** Renders children only when the current view has `permission`, e.g. "batches:manage". */
export function Can({
  permission,
  fallback = null,
  children,
}: {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return useCan(permission) ? children : fallback;
}
