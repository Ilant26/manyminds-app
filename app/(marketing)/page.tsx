import dynamic from 'next/dynamic';
import { Hero } from '@/components/marketing/Hero';
import { AnimatedDemo } from '@/components/marketing/AnimatedDemo';
import { Footer } from '@/components/marketing/Footer';
import { ScrollToTopOnLoad } from '@/components/shared/ScrollToTopOnLoad';
import { DeferUntilHeroReady } from '@/components/shared/DeferUntilHeroReady';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

const PricingSection = dynamic(() => import('@/components/marketing/PricingSection'), { ssr: false });

async function getUserCount(): Promise<number> {
  try {
    const base = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/stats`, { cache: 'no-store' });
    const data = await res.json();
    return typeof data.count === 'number' ? data.count : 0;
  } catch {
    return 0;
  }
}

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect('/chat');
  }

  const userCount = await getUserCount();
  return (
    <>
      <ScrollToTopOnLoad />
      <Hero userCount={userCount} />
      <DeferUntilHeroReady delayMs={800}>
        <section
          className="relative border-t border-neutral-200 bg-white px-6 pt-[2.375rem] pb-20 [overflow-anchor:none] min-h-[760px]"
          style={{ overflowAnchor: 'none' } as React.CSSProperties}
        >
          {/* Transition très douce depuis le Hero */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-neutral-50/80 to-transparent"
          />
          <div className="mx-auto max-w-4xl w-full">
            <AnimatedDemo />
          </div>
        </section>
      </DeferUntilHeroReady>
      <PricingSection />
      <section className="border-t border-neutral-200 bg-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold text-white">
            Why trust one AI when you can ask many?
          </h2>
          <a
            href="/chat"
            className="mt-8 inline-block rounded-xl border border-white/20 px-8 py-4 font-bold text-white hover:bg-white/10 transition"
          >
            Get started free →
          </a>
          <p className="mt-4 text-sm text-neutral-400">
            No credit card. Free plan forever.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}