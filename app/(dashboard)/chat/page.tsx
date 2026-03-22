'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useChatPanelsContext } from '@/contexts/ChatPanelsContext';

/**
 * Couche plein écran : backdrop + Escape (les panneaux restent dans ChatWorkspace).
 */
export default function ChatPage() {
  const { fullscreenPanelId, exitFullscreen } = useChatPanelsContext();
  const [backdropVisible, setBackdropVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenPanelId) {
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenPanelId, exitFullscreen]);

  useEffect(() => {
    if (!fullscreenPanelId) {
      setBackdropVisible(false);
      return;
    }
    setBackdropVisible(false);
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setBackdropVisible(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [fullscreenPanelId]);

  if (!fullscreenPanelId) {
    return null;
  }

  return (
    <div
      role="presentation"
      className={cn(
        'fixed bottom-0 right-0 top-0 z-40 bg-black/25 transition-opacity duration-300 ease-out',
        'left-[var(--mm-sidebar-width,4rem)]',
        backdropVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
      onClick={() => exitFullscreen()}
    />
  );
}
