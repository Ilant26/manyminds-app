'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useChatPanels } from '@/hooks/useChatPanels';
import { ChatPanelsContext } from '@/contexts/ChatPanelsContext';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace';
import { isChatRoutePath } from '@/lib/utils';
import type { ChatWorkspaceSsrBootstrap } from '@/lib/chat-workspace-bootstrap-types';

export function ChatPanelsProvider({
  children,
  workspaceBootstrap = null,
}: {
  children: React.ReactNode;
  workspaceBootstrap?: ChatWorkspaceSsrBootstrap | null;
}) {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const isChatRoute = isChatRoutePath(pathname);
  const chat = useChatPanels({
    syncRemote: Boolean(isLoaded && isSignedIn),
    workspaceRouteActive: isChatRoute,
    workspaceSsr: workspaceBootstrap,
  });

  return (
    <ChatPanelsContext.Provider value={chat}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isChatRoute ? (
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ChatWorkspace />
          </div>
        ) : null}
        {!isChatRoute ? (
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        ) : (
          children
        )}
      </div>
    </ChatPanelsContext.Provider>
  );
}
