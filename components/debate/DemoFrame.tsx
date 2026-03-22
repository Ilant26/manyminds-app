'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DemoFrameProps {
  children: ReactNode;
  actions?: ReactNode;
  fullHeight?: boolean;
  /** Couvre uniquement la carte (pas la colonne flex autour) — ex. chargement / restauration session. */
  overlay?: ReactNode;
  /** Plein écran : cadre bord à bord ; le contenu est centré via `max-w-3xl` dans la zone children. */
  variant?: 'card' | 'fullscreen';
  /** Masque la barre noire (logo + actions) — ex. plein écran avec bouton flottant. */
  hideHeader?: boolean;
}

export function DemoFrame({
  children,
  actions,
  fullHeight,
  overlay,
  variant = 'card',
  hideHeader = false,
}: DemoFrameProps) {
  const isFs = variant === 'fullscreen';
  /** Plein écran + fil actif : pas de `px` sur le cadre — le scroll va bord à bord ; le contenu gère son `max-w` dans `ChatPanel`. */
  const pad =
    hideHeader && isFs
      ? fullHeight
        ? 'px-0 pb-4 pt-0'
        : 'px-4 pb-4 pt-0'
      : isFs
        ? 'p-4 sm:p-5'
        : 'p-6';
  const headerNeg = isFs ? '-mx-4 -mt-4 sm:-mx-5 sm:-mt-5' : '-mx-6 -mt-6';
  const overlayBleed =
    hideHeader && isFs
      ? 'absolute inset-0'
      : isFs
        ? 'absolute -top-4 -bottom-4 -left-4 -right-4 sm:-top-5 sm:-bottom-5 sm:-left-5 sm:-right-5'
        : 'absolute -top-5 -bottom-6 -left-6 -right-6';

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-white',
        fullHeight && 'flex min-h-0 flex-1 flex-col',
        isFs
          ? 'mx-0 h-full max-h-full min-h-0 max-w-none rounded-none border-0 shadow-none'
          : 'mx-auto max-h-full max-w-3xl rounded-2xl border border-neutral-200 shadow-sm',
        pad,
        !isFs && 'max-h-full'
      )}
    >
      {!hideHeader ? (
        <div
          className={cn(
            'flex shrink-0 items-center justify-between bg-neutral-950 px-5 py-3',
            isFs ? 'mb-4 rounded-none sm:mb-5' : 'mb-5 rounded-t-2xl',
            headerNeg
          )}
        >
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="ManyMinds" className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-wide text-white/90">ManyMinds</span>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      ) : null}
      <div
        className={
          fullHeight
            ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'relative'
        }
      >
        {/*
          Plein écran + conversation : largeur 100 % pour que la barre de scroll soit au bord du panneau ;
          la colonne `max-w-3xl` est dans `ChatPanel`. Écran « Ask a question » : colonne centrée ici.
        */}
        <div
          className={cn(
            'space-y-4',
            isFs && !fullHeight && 'mx-auto w-full max-w-3xl min-w-0',
            isFs && fullHeight && 'w-full min-w-0',
            fullHeight && 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
          )}
        >
          {children}
        </div>
        {overlay ? (
          <div
            className={cn(
              'pointer-events-auto z-30 !mt-0 flex flex-col items-center justify-center bg-white px-4 text-center shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]',
              overlayBleed,
              isFs || hideHeader ? 'rounded-none' : 'rounded-b-2xl'
            )}
          >
            {overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}

