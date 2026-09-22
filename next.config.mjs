import { deploymentErrors } from './scripts/lib/deployment-config.mjs';
const problems = deploymentErrors(process.env);
if (problems.length)
  throw new Error(
    `Production configuration is incomplete:\n${problems.join('\n')}\nFor an intentional demo build only, set SMARTFIT_DEPLOYMENT=demo.`,
  );

/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig = {
  transpilePackages: ['@smartfit/core'],
  typescript: { ignoreBuildErrors: false },
  // Linting runs as its own CI step (`pnpm lint`); keeping it out of the
  // build keeps `next build` fast and its failures unambiguous.
  eslint: { ignoreDuringBuilds: true },
  // Allow development assets and hot reload through the browser preview proxy.
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          ...(isProduction ? [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] : []),
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(), camera=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
