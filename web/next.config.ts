import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/judge-tests/:path*/public_manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=60, s-maxage=60" },
        ],
      },
      {
        source: "/judge-tests/:path*/public_bundle.:version.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
