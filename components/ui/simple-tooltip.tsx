'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const SHOW_DELAY_MS = 80;

/**
 * Tooltip survol/focus sans Radix (évite les boucles compose-refs avec React 19 / Base UI).
 * Rendu en portail `position: fixed` pour ne pas être coupé par `overflow`.
 */
export function SimpleTooltip({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const showTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, []);

  const updatePosition = React.useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.top - 8,
      left: r.left + r.width / 2,
    });
  }, []);

  const scheduleShow = React.useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      updatePosition();
      setOpen(true);
    }, SHOW_DELAY_MS);
  }, [updatePosition]);

  const hide = React.useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    setOpen(false);
    setPos(null);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  const bubble =
    open && pos ? (
      <span
        role="tooltip"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translate(-50%, -100%)',
        }}
        className={cn(
          'pointer-events-none z-[200] max-w-xs rounded-lg bg-neutral-900 px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-white shadow-lg',
          className
        )}
      >
        {label}
      </span>
    ) : null;

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onPointerEnter={scheduleShow}
        onPointerLeave={hide}
        onFocusCapture={scheduleShow}
        onBlurCapture={hide}
      >
        {children}
      </span>
      {typeof document !== 'undefined' && bubble
        ? createPortal(bubble, document.body)
        : null}
    </>
  );
}
