import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    turbopack: {},
    images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "example.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },


  webpack(config) {
    // Normal SVG loader for non-React imports
    config.module.rules.push({
      test: /\.svg$/i,
      type: "asset/resource",
      resourceQuery: { not: [/react/] },
      issuer: { not: [/\.[jt]sx?$/] },
    });

    // SVG as React component
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [
        {
          loader: "@svgr/webpack",
          options: {
            icon: true,
            svgo: true,
            svgoConfig: {
              plugins: [
                { removeDimensions: true },
                { convertColors: { currentColor: true } },   // ⭐ KEY FIX
                { removeAttrs: { attrs: "(fill|stroke)" } }, // ⭐ Removes fixed fills
              ],
            },
          },
        },
      ],
    });

    return config;
  },
};

export default nextConfig;
