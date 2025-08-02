import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Ignore ESLint errors during `next build`
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Allow all external image sources
      },
    ],
  },
  // Ensure compatibility with Cloudflare Pages
  output: "standalone", // Recommended for Next.js on Cloudflare Pages
};

export default nextConfig;