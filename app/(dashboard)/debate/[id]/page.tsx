import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { getUserByClerkId } from '@/lib/db/users';
import { getDebateByIdForUser } from '@/lib/db/debates';
import { DebateView } from './DebateView';

export default async function DebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();
  const user = await getUserByClerkId(userId);
  if (!user) notFound();
  const { id } = await params;
  const debate = await getDebateByIdForUser(id, user.id);
  if (!debate) notFound();
  const isPlusOrAbove = true; // PDF export free for everyone
  return (
    <DebateView debate={debate} canExportPdf={isPlusOrAbove} />
  );
}
