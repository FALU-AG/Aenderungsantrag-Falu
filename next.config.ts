import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows validation builds to avoid transient OneDrive locks on the default folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Playwright uses 127.0.0.1 while local development normally uses localhost.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // The application validates each attachment at 20 MB. Allow the multipart
    // envelope a small amount of additional headroom before app validation.
    serverActions: { bodySizeLimit: "21mb" },
  },
};

export default nextConfig;
