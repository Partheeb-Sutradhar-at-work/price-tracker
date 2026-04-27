import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazon.com" },
      { protocol: "https", hostname: "**.amazon.ca" },
      { protocol: "https", hostname: "**.amazon.co.uk" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "**.bbystatic.com" },
      { protocol: "https", hostname: "**.bestbuy.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
