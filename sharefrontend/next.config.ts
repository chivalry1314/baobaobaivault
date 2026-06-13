import type { NextConfig } from "next";

const backendOrigin = process.env.SHARE_BACKEND_ORIGIN ?? "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },
  experimental: {
    // Theme packages are validated by backend with a 20MB limit.
    // Leave some headroom for multipart/form-data overhead when requests
    // are proxied through Next.js rewrites.
    proxyClientMaxBodySize: "32mb",
  },
  async redirects() {
    return [
      {
        source: "/discover",
        destination: "/",
        permanent: true,
      },
    ];
  },
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
