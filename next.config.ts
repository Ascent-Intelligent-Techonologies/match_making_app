import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure App Service runs the app with `node server.js`, which needs the
  // standalone bundle: the server plus only the dependencies it actually
  // traces, around 50 MB instead of a full node_modules upload. It is opt-in
  // so Vercel builds, which do their own tracing, are untouched.
  output: process.env.AZURE_BUILD === "1" ? "standalone" : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    // Photos come from a private Blob container as SAS URLs, which carry the
    // token in the query string; next/image keys its cache on the full URL,
    // so a fresh token each hour means a fresh optimisation each hour.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
