import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/b',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@taskapp/contracts'],
  // Dev only: `output: 'export'` ignores redirects, so this exists just to send :3000/ to the shell.
  ...(process.env.NODE_ENV === 'development'
    ? { async redirects() { return [{ source: '/', destination: '/b/', permanent: false, basePath: false }]; } }
    : {}),
};

export default nextConfig;
