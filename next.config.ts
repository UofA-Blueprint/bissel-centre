import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["example.com", "firebasestorage.googleapis.com"], // Add your image hostnames here
  },
};

export default nextConfig;
