import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true, // This allows the build to proceed even if there are ESLint errors
  },
};

export default nextConfig;
