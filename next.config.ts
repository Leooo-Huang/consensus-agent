import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
};

export default config;
