import path from "node:path";
import type { NextConfig } from "next";

// On Vercel the browser's /api/* calls are rewritten straight to the worker project by Vercel's edge,
// so they cost no function call in this project (the free plan counts them). Everywhere else
// (local dev, the VM's Docker network) app/api/[...path]/route.ts forwards them instead.
const workerUrl = process.env.WORKER_URL?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // web/ is its own app inside the monorepo (the root package.json only holds dev tooling),
  // so pin the project root here instead of letting Next pick the repo root's lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    if (!process.env.VERCEL || !workerUrl) return [];
    return { beforeFiles: [{ source: "/api/:path*", destination: `${workerUrl}/:path*` }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
