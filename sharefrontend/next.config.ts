import type { NextConfig } from "next";

const backendOrigin = process.env.SHARE_BACKEND_ORIGIN ?? "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/share/:path*",
        destination: `${backendOrigin}/api/share/:path*`,
      },
    ];
  },
};

export default nextConfig;
