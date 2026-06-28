// Three build modes:
//   GHPAGES=1   → static HTML export for GitHub Pages / Netlify / S3 / any static host
//   STANDALONE=1 → self-contained .next/standalone for Docker / VPS / bare-metal Node
//   (default)   → standard Next.js build for Vercel / Render / Railway / Cloudflare Pages
const isGhPages  = process.env.GHPAGES  === "1" || process.env.GHPAGES  === "true";
const isStandalone = process.env.STANDALONE === "1" || process.env.STANDALONE === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isStandalone && !isGhPages ? { output: "standalone" } : {}),
  ...(isGhPages ? {
    output: "export",
    // GitHub Pages serves the repo at https://<user>.github.io/<repo>/
    basePath: "/fazai",
    assetPrefix: "/fazai/",
    images: { unoptimized: true },
    trailingSlash: true,
  } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {},
};

module.exports = nextConfig;
