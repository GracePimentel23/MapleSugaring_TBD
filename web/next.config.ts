import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web/ is its own app inside the monorepo (the root package.json only holds dev tooling),
  // so pin the project root here instead of letting Next pick the repo root's lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
