import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating "N" route badge in dev; it covered the phone tab bar.
  // Compile and runtime errors still show.
  devIndicators: false,
};

export default nextConfig;
