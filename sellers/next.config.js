const path = require("path")

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  reactStrictMode: true,
  // @medusajs/icons ships one module per icon and @medusajs/ui re-exports a lot;
  // importing from the barrel made dev compile ~5000 modules per page. This
  // rewrites barrel imports to the individual modules actually used.
  experimental: {
    optimizePackageImports: ["@medusajs/icons", "@medusajs/ui"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

// `ANALYZE=true pnpm build` writes bundle reports to .next/analyze. A no-op otherwise.
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  analyzerMode: process.env.ANALYZE_MODE || "static",
})

module.exports = withBundleAnalyzer(nextConfig)
