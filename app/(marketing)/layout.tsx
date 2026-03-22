import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { CookieBanner } from '@/components/shared/CookieBanner';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a08]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-white">
            <img src="/logo.svg" alt="ManyMinds" className="h-7 w-7" />
            ManyMinds
          </Link>
          <nav className="flex items-center gap-4">
            <SignedIn>
              <Link href="/chat" className="text-sm font-medium text-white/90 hover:text-white">
                Chat
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>

            <SignedOut>
              <Link
                href="/chat"
                className="text-sm font-semibold text-white/90 hover:text-white"
              >
                Get started for free
              </Link>
            </SignedOut>
          </nav>
        </div>
      </header>
      {children}
      <CookieBanner />
    </div>
  );
}