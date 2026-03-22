import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Toaster } from 'sonner';
import { Inter } from 'next/font/google';
import { PostHogProvider } from '@/components/providers/PostHogProvider';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Manyminds — Many minds One answer',
  description: 'Type or speak. 6 AIs analyze. Manyminds synthesizes.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <ClerkProvider>
      <html
        lang={locale ?? 'en'}
        className={cn('font-sans', inter.variable)}
        suppressHydrationWarning
      >
        <body className="min-h-screen bg-[#0a0a08] font-sans text-[#f5f5f3] antialiased">
          <PostHogProvider>
            <NextIntlClientProvider locale={locale ?? 'en'} messages={messages}>
              {children}
              <Toaster theme="dark" position="bottom-right" />
            </NextIntlClientProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
