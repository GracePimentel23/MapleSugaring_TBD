import "server-only";

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
    const response = await fetch(`${base}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      console.error(`worker ${path} -> ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`worker ${path} unreachable: ${(error as Error).message}`);
    return null;
  }
}
