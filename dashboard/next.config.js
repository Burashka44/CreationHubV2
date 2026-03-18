/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  images: { unoptimized: true },
  // All pages are client components using useEffect — skip static generation errors
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};
module.exports = nextConfig;
