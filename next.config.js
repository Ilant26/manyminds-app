const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n.ts');

// Évite le mode keyless Clerk quand une publishable key est définie (cookies / .clerk obsolètes).
if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) {
  process.env.NEXT_PUBLIC_CLERK_KEYLESS_DISABLED = 'true';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  // Aide le bundle middleware (Edge) à embarquer la clé lue au démarrage depuis .env.local
  ...(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? {
        env: {
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        },
      }
    : {}),
};

module.exports = withNextIntl(nextConfig);
