import type { NextConfig } from "next";

const API_URL = process.env.API_URL || "http://localhost:3000";

const nextConfig: NextConfig = {
  /* GInaTor: proxy API calls to Express backend */
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/auth/:path*", destination: `${API_URL}/auth/:path*` },
      { source: "/admin/:path*", destination: `${API_URL}/admin/:path*` },
      { source: "/webhooks/:path*", destination: `${API_URL}/webhooks/:path*` },
      { source: "/health", destination: `${API_URL}/health` },
      { source: "/csrf-token", destination: `${API_URL}/csrf-token` },
    ];
  },
  devIndicators: false,
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  images: {
    localPatterns: [{ pathname: "/**" }],
  },
  turbopack: {
    rules: {
      "*.svg": { loaders: ["@svgr/webpack"], as: "*.js" },
    },
  },
};

export default nextConfig;
