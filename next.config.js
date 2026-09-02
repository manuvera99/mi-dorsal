/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  experimental: {
    reactCompiler: false,
  },
};

module.exports = nextConfig;
