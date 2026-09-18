import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CSV imports send every row in one request; the 1 MB default is too small
    // for a year of card activity.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
