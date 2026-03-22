'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PDFButtonProps {
  debateId: string;
  canExport: boolean;
  disabled?: boolean;
}

export function PDFButton({ debateId, canExport, disabled }: PDFButtonProps) {
  const t = useTranslations('debate');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!canExport || disabled) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/debate/${debateId}/pdf`);
      if (!res.ok) {
        if (res.status === 403) {
          toast.error(t('pdfPlusOnly'));
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manyminds-decision-brief-${debateId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const tooltipLabel = canExport ? t('downloadPdf') : t('pdfPlusOnly');
  const isDisabled = Boolean(disabled || loading || !canExport);

  return (
    <SimpleTooltip label={tooltipLabel}>
      <button
        type="button"
        aria-disabled={isDisabled}
        aria-busy={loading}
        aria-label={tooltipLabel}
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
          void handleDownload();
        }}
      >
        <FileDown className="h-4 w-4" aria-hidden />
      </button>
    </SimpleTooltip>
  );
}
