import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't fail builds on stray TS errors in WIP backend code (lib/seed,
  // lib/agent, kali-data). Frontend pages still get compiled and the
  // `bun typecheck` script (manual) is the source of truth for strictness.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Same for eslint — frontend warnings shouldn't block deploys.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
