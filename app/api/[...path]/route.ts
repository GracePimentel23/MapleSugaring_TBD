import type { NextRequest } from "next/server";

/**
 * Same-origin proxy, as on main (web/app/api/[...path]/route.ts): the browser calls /api/<path> and
 * this forwards to WORKER_URL/<path>. Sign-in depends on it: the session cookie belongs to the web
 * origin, and the Google redirect and callback (/api/auth/google...) pass through here.
 * With WORKER_URL unset it answers 503 and the app stays in demo mode.
 */
export const dynamic = "force-dynamic";

// cookie carries the session to the worker; set-cookie and location come back for the OAuth flow.
const FORWARDED_HEADERS = ["content-type", "accept", "x-ingest-key", "cookie"];

function workerUrl(): string | null {
  const url = process.env.WORKER_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

async function forward(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const base = workerUrl();
  if (!base) {
    return Response.json({ error: "WORKER_URL is not set; the API is not connected" }, { status: 503 });
  }
  const { path } = await ctx.params;
  const target = `${base}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const responseHeaders = new Headers({
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    });
    const location = upstream.headers.get("location");
    if (location) responseHeaders.set("location", location);
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    return Response.json({ error: `worker unreachable: ${(error as Error).message}` }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
