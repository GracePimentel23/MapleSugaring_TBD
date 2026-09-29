// Docker healthcheck for tbd-web (the shared compose file probes GET /health on PORT).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "tbd-web" });
}
