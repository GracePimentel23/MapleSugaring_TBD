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
      // 401/403 just mean "signed out"; the login gate in the layout handles that.
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
  role: "viewer" | "member" | "admin";
}

export interface AuthState {
  authEnabled: boolean;
  user: SessionUser | null;
}

/** Sign-in state from the worker; null when the worker is unset or down (sample-data mode, no gate). */
export function loadAuth(): Promise<AuthState | null> {
  return fetchWorker<AuthState>("/auth/me");
}
