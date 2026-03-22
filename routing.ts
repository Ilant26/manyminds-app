/** English-only for now; `/fr/*` redirects in middleware. */
export const routing = {
  locales: ['en'] as const,
  defaultLocale: 'en' as const,
  localePrefix: 'as-needed' as const,
};
