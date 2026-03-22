import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkMiddleware, type ClerkMiddlewareOptions } from '@clerk/nextjs/server';
import { isPublishableKey } from '@clerk/shared';

function normalizeEnvValue(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  return value.replace(/^\uFEFF/, '').trim();
}

function clerkPublishableKeyFromEnv(): string {
  return normalizeEnvValue(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY
  );
}

function clerkSecretKeyFromEnv(): string {
  return normalizeEnvValue(process.env.CLERK_SECRET_KEY);
}

/**
 * Résolu à chaque requête (évite une clé figée au mauvais moment dans le bundle Edge)
 * et refuse une publishable key invalide au lieu de retomber sur un cookie keyless corrompu.
 */
async function resolveClerkMiddlewareOptions(_req: NextRequest): Promise<ClerkMiddlewareOptions> {
  const publishableKey = clerkPublishableKeyFromEnv();
  const secretKey = clerkSecretKeyFromEnv();

  if (!publishableKey && !secretKey) {
    return {};
  }

  if (publishableKey && !secretKey) {
    throw new Error(
      'Clerk : CLERK_SECRET_KEY est manquante alors que NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY est définie.'
    );
  }
  if (!publishableKey && secretKey) {
    throw new Error('Clerk : NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY est manquante.');
  }

  if (!isPublishableKey(publishableKey)) {
    throw new Error(
      'Clerk : la publishable key dans .env.local est rejetée (format invalide). ' +
        'Supprime les cookies du site sur localhost, supprime le dossier .clerk/ à la racine du repo, ' +
        'puis recolle la clé complète depuis le dashboard (API Keys). ' +
        'Vérifie une seule ligne sans guillemets : NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...'
    );
  }

  return { publishableKey, secretKey };
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/pricing') return true;
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) return true;
  if (pathname === '/dashboard' || pathname === '/chat') return true;
  if (pathname === '/history' || pathname === '/upgrade' || pathname === '/settings' || pathname === '/projects') return true;
  if (/^\/debate\/[^/]+\/share$/.test(pathname)) return true;
  if (pathname.startsWith('/api/webhooks/') || pathname === '/api/stats') return true;
  if (pathname === '/api/checkout') return true;
  if (pathname === '/api/debate') return true;
  if (pathname === '/api/anonymous-usage') return true;
  if (pathname === '/api/projects' || pathname.startsWith('/api/projects/')) return true;
  if (pathname === '/api/debug/clerk-env') return true;
  return false;
}

export default clerkMiddleware(
  (auth, req) => {
    const { pathname } = req.nextUrl;
    /** Legacy French URLs → English-only app */
    if (pathname === '/fr' || pathname === '/fr/' || pathname.startsWith('/fr/')) {
      const url = req.nextUrl.clone();
      url.pathname =
        pathname === '/fr' || pathname === '/fr/' ? '/' : pathname.slice(3) || '/';
      return NextResponse.redirect(url);
    }
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/webhooks/') && pathname !== '/api/stats') {
      return auth().then(({ userId }) => {
        if (!userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.next();
      });
    }
    return NextResponse.next();
  },
  resolveClerkMiddlewareOptions
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/api/(.*)',
  ],
};
