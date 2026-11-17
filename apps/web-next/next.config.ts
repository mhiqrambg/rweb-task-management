import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // No basePath. Next 16's client router builds RSC payload URLs without it, so a cold load under
  // `/b` hydrated the root landing payload (which carries a not-found boundary) and rendered
  // "Page not found". O-12 (`.planning/04`) wanted `/b/app/…`; the app now serves `/app/…`, which
  // matches Astro's member-app route exactly.
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@taskapp/contracts'],
  // Dev only: `output: 'export'` ignores redirects, so this exists just to send :3000/ to the shell.
  ...(process.env.NODE_ENV === 'development'
    ? { async redirects() { return [{ source: '/', destination: '/app/', permanent: false }]; } }
    : {}),
};

export default nextConfig;
