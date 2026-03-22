import { auth } from '@clerk/nextjs/server';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ChatPanelsProvider } from '@/components/providers/ChatPanelsProvider';
import { getUserByClerkId } from '@/lib/db/users';
import { loadChatWorkspaceBootstrapForUser } from '@/lib/server/load-chat-workspace-bootstrap';
import type { Plan } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const user = userId ? await getUserByClerkId(userId) : null;
  const plan = ((user?.plan ?? 'free') as Plan) ?? 'free';
  const workspaceBootstrap =
    user?.id != null ? await loadChatWorkspaceBootstrapForUser(user.id) : null;

  return (
    <DashboardShell plan={plan}>
      <ChatPanelsProvider workspaceBootstrap={workspaceBootstrap}>
        {children}
      </ChatPanelsProvider>
    </DashboardShell>
  );
}
