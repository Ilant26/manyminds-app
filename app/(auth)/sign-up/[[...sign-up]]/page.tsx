import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { CustomSignUpForm } from './CustomSignUpForm';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-white">
            <img src="/logo.svg" alt="ManyMinds" className="h-7 w-7" />
            ManyMinds
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <SignedIn>
              <Link href="/chat" className="font-medium text-white/90 hover:text-white">
                Chat
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link
                href="/"
                className="rounded-full border border-white/20 px-4 py-1.5 font-semibold text-white/90 hover:bg-white/10 hover:text-white transition"
              >
                Back to homepage
              </Link>
            </SignedOut>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col items-center justify-center px-6 py-12">
        <div className="grid w-full gap-10 rounded-3xl border border-neutral-200 bg-white p-8 shadow-lg md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-10">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600">
              Many minds, one account
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Create your ManyMinds account in seconds.
            </h1>
            <p className="text-sm text-neutral-500 sm:text-base leading-relaxed">
              One account to compare top AI answers instantly and keep every conversation in one place.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <CustomSignUpForm />
            <p className="text-sm text-neutral-500">
              Already have an account?{' '}
              <Link href="/sign-in" className="font-semibold text-violet-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
