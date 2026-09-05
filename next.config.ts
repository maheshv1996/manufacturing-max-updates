import type { NextConfig } from "next";

const pkg = require("./package.json");

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "trycloudflare.com",
    "dash-teach-living-one.trycloudflare.com",
    "experiments-occasion-focuses-yeah.trycloudflare.com",
  ],
  // Offline edition: standalone output so the desktop launcher can serve
  // the app without the Next CLI (node server.js + .next/standalone).
  output: "standalone",
  // Single source of truth for the app version: package.json is baked in at
  // build time, so process.env.APP_VERSION is always set (cloud, dev, and the
  // desktop launcher which ALSO passes it explicitly at runtime). Any surface
  // that shows a version reads process.env.APP_VERSION — bump once in
  // package.json and everywhere follows. A real env var set at runtime takes
  // precedence over this baked value (Next never overrides existing env).
  // Hardening: disable framework fingerprint header
  poweredByHeader: false,
  env: {
    APP_VERSION: pkg.version,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
