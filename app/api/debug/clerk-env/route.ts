import { NextResponse } from 'next/server';
import { isPublishableKey } from '@clerk/shared';

export const dynamic = 'force-dynamic';

/**
 * Dev uniquement : métadonnées sur les clés Clerk (sans exposer les secrets).
 * Ouvre http://localhost:3000/api/debug/clerk-env après npm run dev.
 */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rawPk =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || '';
  const pk = rawPk.replace(/^\uFEFF/, '').trim();
  const sk = (process.env.CLERK_SECRET_KEY || '').replace(/^\uFEFF/, '').trim();
  const parts = pk.split('_');

  const pkOk = isPublishableKey(pk);
  const skOk = sk.startsWith('sk_test_') || sk.startsWith('sk_live_');
  const pair =
    pk.startsWith('pk_test_') && sk.startsWith('sk_test_')
      ? 'both_test'
      : pk.startsWith('pk_live_') && sk.startsWith('sk_live_')
        ? 'both_live'
        : pk && sk
          ? 'mismatch_test_vs_live'
          : 'incomplete';

  return NextResponse.json({
    publishableKey: {
      present: Boolean(pk),
      length: pk.length,
      underscoreSegmentCount: parts.length,
      passesClerkValidation: pkOk,
    },
    secretKey: {
      present: Boolean(sk),
      length: sk.length,
      looksLikeSecretKey: skOk,
    },
    pair: { kind: pair, testLiveMismatch: pair === 'mismatch_test_vs_live' },
    nextSteps: !pkOk
      ? 'Recopie la Publishable key complète depuis Clerk → API Keys (un seul long segment après pk_test_ ou pk_live_).'
      : !skOk
        ? 'Vérifie CLERK_SECRET_KEY (sk_test_ ou sk_live_).'
        : pair === 'mismatch_test_vs_live'
          ? 'Aligne les environnements : pk_test_ avec sk_test_, ou pk_live_ avec sk_live_ (même instance Clerk).'
          : 'Si le middleware plante encore : arrête le serveur, rm -rf .next, npm run dev. Si passesClerkValidation est true ici mais erreur middleware, signale un décalage Edge.',
  });
}
