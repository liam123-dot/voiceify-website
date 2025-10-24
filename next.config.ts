import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.pipedream.net',
      },
      {
        protocol: 'https',
        hostname: 'media.rightmove.co.uk',
      }
    ],
  }
};

export default nextConfig;
