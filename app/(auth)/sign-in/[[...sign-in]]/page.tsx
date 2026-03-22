import Link from 'next/link';
import { SignIn, SignedIn as SignedInComponent, SignedOut, UserButton } from '@clerk/nextjs';

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const redirectUrl =
    typeof searchParams?.redirect_url === 'string' ? searchParams.redirect_url : '/chat';

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-white">
            <img src="/logo.svg" alt="ManyMinds" className="h-7 w-7" />
            ManyMinds
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <SignedInComponent>
              <Link href="/chat" className="font-medium text-white/90 hover:text-white">
                Chat
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedInComponent>
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
              Sign in to pick up where you left off.
            </h1>
            <p className="text-sm text-neutral-500 sm:text-base leading-relaxed">
              Your questions, synthesis, projects, and personal memory are all synced in one place.
              Pick up exactly where you left off.
            </p>
          </div>

          <div className="flex justify-center">
            <SignIn
              appearance={{
                variables: {
                  colorBackground: '#ffffff',
                  colorInputBackground: '#fafafa',
                  colorInputText: '#171717',
                  colorText: '#262626',
                  colorPrimary: '#7c3aed',
                  borderRadius: '0.75rem',
                },
                elements: {
                  card: 'shadow-none border border-neutral-200 bg-white',
                  headerTitle: 'text-neutral-900',
                  headerSubtitle: 'text-neutral-500',
                  formButtonPrimary:
                    'bg-neutral-900 text-white hover:bg-neutral-800 font-semibold rounded-xl',
                  footerAction: 'text-neutral-500',
                },
              }}
              routing="path"
              path="/sign-in"
              afterSignInUrl={redirectUrl}
              signUpUrl="/sign-up"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
