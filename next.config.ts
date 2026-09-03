import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // GrowthOS ships as a self-contained demo: no external image hosts, no telemetry.
  images: { unoptimized: true },
};

export default nextConfig;
