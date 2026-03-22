'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { ShareButton } from './ShareButton';
import { PDFButton } from './PDFButton';
import { DebateGrid } from './DebateGrid';
import { MarkdownLite } from './MarkdownLite';
import { DisagreementFlag } from './DisagreementFlag';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AIResponse, DisagreementDetail } from '@/types';

function agreementLabelKey(
  pct: number
): 'strongConsensus' | 'generalAgreement' | 'significantDisagreement' {
  if (pct > 80) return 'strongConsensus';
  if (pct >= 60) return 'generalAgreement';
  return 'significantDisagreement';
}

interface ManymindsAnswerProps {
  synthesis: string;
  debateId: string | null;
  canExportPdf: boolean;
  mode?: 'quick' | 'deep';
  /**
   * Score juge 0–100, ou -1 si inconnu / non calculé.
   * Toujours le transmettre depuis le hook pour que le détail puisse afficher un message explicite.
   */
  consensusScore?: number;
  /** true pendant chargement / stream du débat (hors idle / done / error terminal). */
  debateLoading?: boolean;
  /** Réponses des modèles : affichage repliable dans la même carte. */
  responses?: AIResponse[];
  /** Désaccords détaillés (même bloc que le chat). */
  disagreements?: DisagreementDetail[];
  /** Mode contrôlé (ex. panneau chat principal). */
  providersOpen?: boolean;
  onToggleProviders?: () => void;
  /** Pas d’animation d’entrée (streaming) — évite la surcharge framer-motion à chaque token. */
  disableMotion?: boolean;
}

export function ManymindsAnswer({
  synthesis,
  debateId,
  canExportPdf,
  consensusScore: consensusScoreProp,
  debateLoading = false,
  responses = [],
  disagreements = [],
  providersOpen: providersOpenControlled,
  onToggleProviders,
  disableMotion = false,
}: ManymindsAnswerProps) {
  const t = useTranslations('debate');
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = typeof onToggleProviders === 'function';
  const providersOpen = controlled
    ? Boolean(providersOpenControlled)
    : uncontrolledOpen;
  const toggleProviders = () => {
    if (controlled) onToggleProviders();
    else setUncontrolledOpen((v) => !v);
  };

  const score =
    typeof consensusScoreProp === 'number' && !Number.isNaN(consensusScoreProp)
      ? consensusScoreProp
      : -1;
  const showScore = score >= 0;

  const hasModelAnswers = responses.length > 0;
  const hasDetailsPanel = hasModelAnswers || disagreements.length > 0 || showScore;

  /** Pas de « bulle » autour de la réponse : flux texte pleine largeur (type ChatGPT / Claude). */
  const shellClass = 'relative';

  return (
    <motion.div
      initial={disableMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        disableMotion ? { duration: 0 } : { duration: 0.35, ease: [0.2, 0.8, 0.3, 1] }
      }
      className={shellClass}
    >
      <div>
        <div className="mb-3">
          <MarkdownLite text={synthesis} />
        </div>

        {hasDetailsPanel ? (
          <div className="mb-4">
            <button
              type="button"
              onClick={toggleProviders}
              className="inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium leading-relaxed text-violet-600 underline-offset-2 transition hover:text-violet-800 hover:underline"
              aria-expanded={providersOpen}
            >
              <span>{providersOpen ? t('hideDetails') : t('viewDetails')}</span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-violet-500 transition-transform',
                  providersOpen && 'rotate-180'
                )}
                aria-hidden
              />
            </button>
            {providersOpen ? (
              <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
                <p className="text-sm leading-relaxed text-neutral-600">{t('detailsIntro')}</p>

                {!showScore &&
                disagreements.length === 0 &&
                !hasModelAnswers &&
                !debateLoading ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    {t('detailsEmptyHint')}
                  </p>
                ) : null}

                {(hasModelAnswers || showScore || disagreements.length > 0) && (
                  <div>
                    {(showScore || debateLoading) && (
                      <h3 className="mb-2 text-xs font-medium tracking-wide text-neutral-500">
                        {t('detailsSectionAgreement')}
                      </h3>
                    )}
                    {showScore ? (
                      <div className="space-y-2">
                        <div className="rounded-2xl border border-stone-200/80 bg-gradient-to-br from-stone-50 to-violet-50/30 px-4 py-3 shadow-sm">
                          <p className="text-sm font-semibold text-violet-800">
                            {t('detailsAgreementLine', {
                              pct: Math.round(score),
                              label: t(agreementLabelKey(score)),
                            })}
                          </p>
                          <p className="mt-2 border-t border-stone-200/60 pt-2 text-xs leading-relaxed text-neutral-500">
                            {t('detailsScoreFootnote')}
                          </p>
                        </div>
                      </div>
                    ) : debateLoading ? (
                      <p className="rounded-2xl border border-stone-200/80 bg-stone-50/90 px-4 py-3 text-sm text-neutral-600 shadow-sm">
                        {t('agreementComputing')}
                      </p>
                    ) : (
                      <p className="rounded-2xl border border-stone-200/80 bg-stone-50/90 px-4 py-3 text-sm text-neutral-600 shadow-sm">
                        {t('agreementUnavailable')}
                      </p>
                    )}
                  </div>
                )}

                {disagreements.length > 0 ? (
                  <DisagreementFlag disagreements={disagreements} />
                ) : null}

                {hasModelAnswers ? (
                  <div>
                    <h3 className="mb-2 text-xs font-medium tracking-wide text-neutral-500">
                      {t('detailsSectionModels')}
                    </h3>
                    <DebateGrid responses={responses} collapsibleRows />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {debateId ? (
        <div className="flex w-full flex-wrap items-center justify-start gap-1 border-t border-neutral-100 pt-3">
          <ShareButton debateId={debateId} />
          <PDFButton debateId={debateId} canExport={canExportPdf} />
        </div>
      ) : null}
    </motion.div>
  );
}
