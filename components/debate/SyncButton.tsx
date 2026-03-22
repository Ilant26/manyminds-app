'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncButtonProps {
  isSynced: boolean;
  onSync: () => void;
  onUnsync: () => void;
  disabled?: boolean;
}

export function SyncButton({ isSynced, onSync, onUnsync, disabled }: SyncButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const handleClick = () => {
    if (disabled) return;
    setShowModal(true);
  };

  const handleConfirmSync = () => {
    onSync();
    setShowModal(false);
  };

  const handleConfirmUnsync = () => {
    onUnsync();
    setShowModal(false);
  };

  useEffect(() => {
    if (!showModal) return;
    modalRef.current?.focus?.();
  }, [showModal]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`
          flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all
          ${
            isSynced
              ? 'border-violet-300 bg-violet-50 text-violet-600'
              : 'border-neutral-200 bg-white text-neutral-400 hover:border-violet-200 hover:text-violet-500'
          }
          ${disabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}
        `}
        title={isSynced ? 'Synced — click to disconnect' : 'Sync these conversations'}
      >
        <RefreshCw className={`h-4 w-4 ${isSynced ? 'text-violet-600' : ''}`} />
        <span className="text-xs font-semibold tracking-wide">
          {isSynced ? 'Synced' : 'Sync'}
        </span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            ref={modalRef}
            tabIndex={0}
            role="dialog"
            aria-modal="true"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              e.stopPropagation();
              if (!isSynced) {
                handleConfirmSync();
                return;
              }
              handleConfirmUnsync();
            }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl outline-none"
          >
            {!isSynced ? (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                  <RefreshCw className="h-6 w-6 text-violet-600" />
                </div>
                <h3 className="text-center text-lg font-bold text-neutral-900">
                  Sync these conversations
                </h3>
                <p className="mt-2 text-center text-sm text-neutral-500">
                  When synced, the AIs in each panel will be aware of what's happening in the
                  other conversation - giving you smarter, more connected answers.
                </p>
                <p className="mt-3 text-center text-xs text-neutral-400">
                  You can unsync at any time.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSync}
                    className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
                  >
                    Sync ✓
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                  <RefreshCw className="h-6 w-6 text-violet-600" />
                </div>
                <h3 className="text-center text-lg font-bold text-neutral-900">
                  These conversations are synced
                </h3>
                <p className="mt-2 text-center text-sm text-neutral-500">
                  The AIs are using both conversations as context. Unsync to get independent
                  answers.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl border border-violet-300 px-4 py-2.5 text-sm font-medium text-violet-600 transition hover:bg-violet-50 hover:border-violet-400"
                  >
                    Keep synced
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUnsync}
                    className="flex-1 rounded-xl border border-red-600 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:border-red-700"
                  >
                    Unsync
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
