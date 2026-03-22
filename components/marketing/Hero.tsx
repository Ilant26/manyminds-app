'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';

interface HeroProps {
  userCount: number;
}

export function Hero({ userCount }: HeroProps) {
  const { isSignedIn } = useUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = new Intl.NumberFormat('en-US').format(userCount);

  return (
    <section className="relative flex min-h-[calc(100svh-3.5rem-17rem)] items-center overflow-hidden bg-white px-6 py-10 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>
      <div className="mx-auto w-full max-w-4xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-6xl"
        >
          Many minds
          <br />
          <span className="text-violet-500">One answer</span>
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 text-lg text-neutral-500"
        >
          <p className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            Ask<span className="text-neutral-900">,</span>
          </p>
          <p className="mt-4 text-lg font-medium text-neutral-900 sm:text-xl">
            ChatGPT, Claude, Gemini, DeepSeek, Perplexity and Grok{' '}
            <span className="font-extrabold">
              Analyze<span className="text-neutral-900">...</span>
            </span>
          </p>
          <hr className="my-5 border-neutral-200" />
          <p className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">
            ManyMinds Answers
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          {mounted && isSignedIn ? (
            <Link
              href="/chat"
              className="rounded-xl bg-neutral-900 px-8 py-4 font-bold text-white shadow-sm hover:bg-neutral-800 hover:shadow-md transition-shadow"
            >
              Go to Chat
            </Link>
          ) : (
            <Link
              href="/chat"
              className="rounded-xl bg-neutral-900 px-8 py-4 font-bold text-white shadow-sm hover:bg-neutral-800 hover:shadow-md transition-shadow"
            >
              Get started for free →
            </Link>
          )}
          {mounted && userCount > 0 ? (
            <span className="text-sm text-neutral-400">{count} people joined</span>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}