'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileUp, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuestionInputProps {
  question: string;
  onQuestionChange: (q: string) => void;
  onSubmit: (question: string) => void;
  mode: 'quick' | 'deep';
  onModeChange: (mode: 'quick' | 'deep') => void;
  voiceState: 'idle' | 'recording' | 'transcribing' | 'done' | 'error';
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  disabled?: boolean;
  isAtQuota?: boolean;
  quotaUpgradeUrl?: string;
}

export function QuestionInput({
  question,
  onQuestionChange,
  onSubmit,
  mode,
  onModeChange,
  voiceState,
  onVoiceStart,
  onVoiceStop,
  disabled,
  isAtQuota,
  quotaUpgradeUrl = '/pricing',
}: QuestionInputProps) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const openFilePicker = () => inputRef.current?.click();
  const onFileChange = (files: FileList | null) => {
    setSelectedFile(files?.[0] ?? null);
  };

  const handleSubmit = () => {
    const q = question.trim();
    if (!q || disabled) return;
    onSubmit(q);
  };

  const autoCapitalizeSentences = (value: string) => {
    // Capitalize the first letter of each sentence (after start or after . ! ? followed by whitespace).
    // Keeps string length identical (capitalization only).
    let next = value;
    next = next.replace(/(^\s*)([a-zà-ÿ])/giu, (_m, ws: string, ch: string) => `${ws}${ch.toUpperCase()}`);
    next = next.replace(
      /([.!?]\s*)([a-zà-ÿ])/giu,
      (_m, prefix: string, ch: string) => `${prefix}${ch.toUpperCase()}`
    );
    return next;
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(autoCapitalizeSentences(e.target.value))}
          placeholder={t('placeholder')}
          disabled={disabled}
          rows={4}
          className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 pr-40 text-neutral-900 placeholder:text-neutral-400 focus:border-violet-400 focus:outline-none"
          onKeyDown={(e) => {
            // Enter to send. Shift+Enter keeps a newline.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={(e) => onFileChange(e.target.files)}
          />

          <button
            type="button"
            onClick={openFilePicker}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-[5.6px] text-sm font-bold text-neutral-900 shadow-sm hover:bg-neutral-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileUp className="h-4 w-4" />
            <span>Upload</span>
          </button>

          {selectedFile ? (
            <div className="flex max-w-[140px] items-center gap-2">
              <div className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-600">
                {selectedFile.name}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Remove file"
                title="Remove file"
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {isAtQuota ? (
            <a
              href={quotaUpgradeUrl}
              className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-500/15 transition hover:shadow-sm"
            >
              {tCommon('quotaReached')} →
            </a>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={disabled || !question.trim()}
              className="bg-neutral-900 px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-neutral-800 hover:shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-0"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">{t('submit')}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange('quick')}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            mode === 'quick'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <span className="mr-2">⚡</span>
          Quick
        </button>
        <button
          type="button"
          onClick={() => onModeChange('deep')}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            mode === 'deep'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <span className="mr-2">🔍</span>
          Deep
        </button>
      </div>

      {isAtQuota ? (
        <div className="hidden" />
      ) : (
        <div className="hidden" />
      )}
    </div>
  );
}
