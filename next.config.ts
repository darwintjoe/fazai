import type { NextConfig } from "next";

// STANDALONE=1 (or any truthy value) → produce self-contained .next/standalone
// build for Docker / VPS / bare-metal Node deployment.
// Default (no env var) → standard build that works on Vercel / Netlify /
// Cloudflare Pages / Render / Railway / etc.
const useStandalone = process.env.STANDALONE === "1" || process.env.STANDALONE === "true";

const nextConfig: NextConfig = {
  ...(useStandalone ? { output: "standalone" } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {},
};

export default nextConfig;
