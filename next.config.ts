import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows validation builds to avoid transient OneDrive locks on the default folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
