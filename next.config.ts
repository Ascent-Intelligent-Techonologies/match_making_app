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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
