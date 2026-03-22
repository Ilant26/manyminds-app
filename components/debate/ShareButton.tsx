'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Share2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ShareButtonProps {
  debateId: string;
  disabled?: boolean;
}

export function ShareButton({ debateId, disabled }: ShareButtonProps) {
  const t = useTranslations('debate');
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/debate/${debateId}/share`, {
        method: 'POST',
      });
      if (!res.ok) {
        toast.error('Could not create share link');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      await navigator.clipboard.writeText(url);
      toast.success(t('linkCopied'));
    } catch {
      toast.error('Could not copy link');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = Boolean(disabled || loading);

  return (
    <SimpleTooltip label={t('share')}>
      <button
        type="button"
        aria-disabled={isDisabled}
        aria-busy={loading}
        aria-label={t('share')}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
          isDisabled && 'cursor-not-allowed opacity-50'
        )}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          void handleShare();
        }}
      >
        <Share2 className="h-4 w-4" aria-hidden />
      </button>
    </SimpleTooltip>
  );
}
