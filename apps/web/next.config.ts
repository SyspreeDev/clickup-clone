import type { NextConfig } from "next";

// When SHARE_API_ORIGIN is set (e.g. for a public tunnel), Next proxies the
// API and Socket.io through this same origin so a single tunnel exposes the
// whole app with no cross-origin/CORS issues. Defaults to the local API.
const API_ORIGIN = process.env.SHARE_API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
      { source: "/socket.io/:path*", destination: `${API_ORIGIN}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
