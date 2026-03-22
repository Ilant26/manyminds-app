import { notFound } from 'next/navigation';
import { getDebateByShareSlug } from '@/lib/db/debates';
import { DebateView } from '../DebateView';

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = await params;
  const debate = await getDebateByShareSlug(slug);
  if (!debate) notFound();
  return (
    <div className="min-h-screen bg-[#0a0a08] p-6">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-sm text-[#888885]">Shared conversation</p>
        <DebateView debate={debate} canExportPdf={false} />
      </div>
    </div>
  );
}
