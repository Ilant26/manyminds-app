'use client';

import { useTranslations } from 'next-intl';
import { Mic, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceRecorderProps {
  state: 'idle' | 'recording' | 'transcribing' | 'done' | 'error';
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  state,
  onStart,
  onStop,
  disabled,
}: VoiceRecorderProps) {
  const t = useTranslations('voice');

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait">
        {state === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-red-400 text-sm"
          >
            <span className="relative flex h-10 w-10">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-10 w-10 rounded-full bg-red-500" />
            </span>
            <span>{t('recording')}</span>
            <button
              type="button"
              onClick={onStop}
              className="rounded-lg bg-red-500/20 px-3 py-1 text-sm font-medium text-red-400 hover:bg-red-500/30"
            >
              Stop
            </button>
          </motion.div>
        )}
        {state === 'transcribing' && (
          <motion.div
            key="transcribing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-neutral-500 text-sm"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('transcribing')}
          </motion.div>
        )}
        {(state === 'idle' || state === 'done' || state === 'error') && (
          <motion.button
            key="idle"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onStart}
            disabled={disabled}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 hover:border-violet-300 hover:bg-neutral-50 disabled:opacity-50"
            title={t('record')}
          >
            <Mic className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
