'use client';

interface SyncAnimationProps {
  active: boolean;
  transmitting?: boolean;
}

export function SyncAnimation({ active, transmitting }: SyncAnimationProps) {
  // Tu as demandé : uniquement le bouton Sync, sans ligne/animation.
  // On rend donc volontairement rien ici.
  void active;
  void transmitting;
  return null;
}
