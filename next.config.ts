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
  env: {
    APP_VERSION: pkg.version,
  },
};

export default nextConfig;
