'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('marketing');
  return (
    <footer className="border-t border-neutral-200 bg-neutral-100 px-6 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-base font-extrabold tracking-tight text-neutral-900">
                ManyMinds
              </span>
              <span className="text-sm font-medium text-neutral-500">
                {t('footerTagline')}
              </span>
            </div>
            <a
              href="mailto:contact@manyminds.io"
              className="text-sm font-semibold text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-4"
            >
              contact@manyminds.io
            </a>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-neutral-700">
            <Link href="/legal" className="hover:text-neutral-900 hover:underline underline-offset-4">
              Legal Notice
            </Link>
            <Link href="/privacy" className="hover:text-neutral-900 hover:underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-neutral-900 hover:underline underline-offset-4">
              Terms of Service
            </Link>
            <Link href="/refunds" className="hover:text-neutral-900 hover:underline underline-offset-4">
              Refund Policy
            </Link>
          </nav>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium">© {new Date().getFullYear()} ManyMinds</span>
          <span className="font-medium">Operated by KLIKANGO (SAS)</span>
        </div>
      </div>
    </footer>
  );
}