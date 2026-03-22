import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-bold text-white">
            <img src="/logo.svg" alt="ManyMinds" className="h-7 w-7" />
            ManyMinds
          </div>
          <div className="h-6 w-24 animate-pulse rounded bg-white/10" />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col items-center justify-center px-6 py-12">
        <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 shadow-lg md:p-10">
          <div className="h-9 w-2/3 animate-pulse rounded bg-neutral-100" />
          <div className="mt-4 h-5 w-5/6 animate-pulse rounded bg-neutral-100" />
          <div className="mt-10 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-violet-600" />
          </div>
          <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
        </div>
      </main>
    </div>
  );
}

