'use client';

import { createContext, useContext } from 'react';
import type { useChatPanels } from '@/hooks/useChatPanels';

export type ChatPanelsContextValue = ReturnType<typeof useChatPanels>;

export const ChatPanelsContext = createContext<ChatPanelsContextValue | null>(null);

export function useChatPanelsContext() {
  const v = useContext(ChatPanelsContext);
  if (!v) {
    throw new Error('useChatPanelsContext must be used within ChatPanelsProvider');
  }
  return v;
}
