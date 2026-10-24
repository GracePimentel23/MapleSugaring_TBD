/**
 * Browser-side writes through the /api proxy. Throws with the worker's error message on failure;
 * the error's `data` holds the rest of the error body (e.g. `canForce`).
 */
export async function sendJson<T = unknown>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string }).error ?? `request failed (${response.status})`;
    throw Object.assign(new Error(message), { data });
  }
  return data as T;
}

/** Reads the named fields of a form as trimmed strings (empty fields are left out). */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string" && value.trim() !== "") values[key] = value.trim();
  }
  return values;
}
