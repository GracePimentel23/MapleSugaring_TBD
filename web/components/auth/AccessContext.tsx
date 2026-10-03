"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Access } from "@/lib/api/server";

/**
 * Show or hide parts of the UI by role. Who sees what is decided in worker/src/rbac.config.js
 * (see docs/RBAC.md); this file only reads the answer the worker sends in GET /api/auth/me.
 *
 *   <ShowFor id="dashboard.sapChart"><SapCollectedChart ... /></ShowFor>
 *   const canLog = useCan("collections:log");
 *
 * Hiding is cosmetic: the worker refuses the action anyway if the role lacks the permission.
 */

const AccessContext = createContext<Access | null>(null);

export function AccessProvider({ access, children }: { access: Access | null; children: ReactNode }) {
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

/** Who is looking. null when the worker is not connected (sample data): then everything shows. */
export function useAccess(): Access | null {
  return useContext(AccessContext);
}

/** For lists and loops, where a hook per item is not allowed. */
export function shows(access: Access | null, id: string): boolean {
  if (access === null) return true;
  const visible = access.components[id];
  if (visible === undefined && process.env.NODE_ENV !== "production") {
    console.warn(`ShowFor: "${id}" is not in COMPONENTS in worker/src/rbac.config.js, so it is hidden`);
  }
  return visible === true;
}

export function can(access: Access | null, permission: string): boolean {
  return access === null || access.permissions.includes(permission);
}

export function useShows(id: string): boolean {
  return shows(useAccess(), id);
}

export function useCan(permission: string): boolean {
  return can(useAccess(), permission);
}

/** Renders children only for roles that may see component `id`; otherwise `fallback` (default nothing). */
export function ShowFor({ id, fallback = null, children }: { id: string; fallback?: ReactNode; children: ReactNode }) {
  return useShows(id) ? children : fallback;
}

/** Renders children only when the current role has `permission`, e.g. "batches:manage". */
export function Can({ permission, fallback = null, children }: { permission: string; fallback?: ReactNode; children: ReactNode }) {
  return useCan(permission) ? children : fallback;
}
