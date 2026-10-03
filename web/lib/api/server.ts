import "server-only";

import { headers } from "next/headers";

/**
 * Server-side calls to the worker API (WORKER_URL, e.g. http://tbd-worker:4000 in Docker or
 * http://localhost:4000 in local dev). Returns null when WORKER_URL is unset or the worker is down,
 * so every page can fall back to the bundled sample data instead of erroring.
 */
export function workerUrl(): string | null {
  const url = process.env.WORKER_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

export async function fetchWorker<T>(path: string): Promise<T | null> {
  const base = workerUrl();
  if (!base) return null;
  try {
    // Pass the visitor's session cookie along so the worker sees who is asking.
    const cookie = (await headers()).get("cookie");
    const response = await fetch(`${base}${path}`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      // 401/403 mean this role may not read it (rbac.config.js); the UI hides those parts.
      if (response.status !== 401 && response.status !== 403) console.error(`worker ${path} -> ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`worker ${path} unreachable: ${(error as Error).message}`);
    return null;
  }
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  /** A role name from worker/src/rbac.config.js, e.g. "member", "manager", "owner". */
  role: string;
}

/** GET /auth/me: who is looking and what they may see and do. Roles are in worker/src/rbac.config.js. */
export interface Access {
  authEnabled: boolean;
  /** null when signed out (the guest view) or when sign-in is off. */
  user: SessionUser | null;
  /** "guest" when signed out; null when sign-in is off and everything is allowed. */
  role: string | null;
  /** e.g. ["dashboard:view", "collections:log"]. */
  permissions: string[];
  /** Every component id in rbac.config.js COMPONENTS -> whether this role sees it. */
  components: Record<string, boolean>;
  /** With sign-in off: the "View as" choices for testing ("all", "guest", roles...). null with sign-in on. */
  viewAs: string[] | null;
}

/** Sign-in state from the worker; null when the worker is unset or down (sample-data mode: no limits). */
export function loadAuth(): Promise<Access | null> {
  return fetchWorker<Access>("/auth/me");
}
