import type { NextRequest } from "next/server";
import { workerUrl } from "@/lib/api/server";

/**
 * Same-origin proxy: the browser calls /api/<path>, this forwards to WORKER_URL/<path>.
 * In Docker the worker is only reachable on the internal network, so it has to go through here.
 * The gateway bridge can post to /api/ingest the same way.
 */
export const dynamic = "force-dynamic";

// cookie carries the session to the worker (sign-in); set-cookie and location come back for the OAuth flow.
const FORWARDED_HEADERS = ["content-type", "accept", "x-ingest-key", "cookie"];

async function forward(request: NextRequest, ctx: RouteContext<"/api/[...path]">) {
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
