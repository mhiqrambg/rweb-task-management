import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/b',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@taskapp/contracts'],
};

export default nextConfig;
