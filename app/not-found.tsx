import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <h1 className="text-3xl font-bold text-neutral-900">404</h1>
      <p className="text-neutral-600">Page not found.</p>
      <Link
        href="/"
        className="rounded-xl bg-neutral-900 px-6 py-3 font-bold text-white hover:bg-neutral-800"
      >
        Go home
      </Link>
    </div>
  );
}
