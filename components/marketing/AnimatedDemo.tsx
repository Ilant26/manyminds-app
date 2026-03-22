'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ProviderName = 'Claude' | 'ChatGPT' | 'Gemini' | 'DeepSeek' | 'Perplexity' | 'Grok';

interface DemoScene {
  question: string;
  synthesis: string;
  consensus: number;
}

const PROVIDERS: { name: ProviderName; color: string }[] = [
  { name: 'ChatGPT', color: '#10B981' },
  { name: 'Claude', color: '#D97706' },
  { name: 'Gemini', color: '#3B82F6' },
  { name: 'DeepSeek', color: '#8B5CF6' },
  { name: 'Perplexity', color: '#06B6D4' },
  { name: 'Grok', color: '#EC4899' },
];

const SCENES: DemoScene[] = [
  {
    question: 'Should I take this job offer or stay in my current role?',
    consensus: 82,
    synthesis:
      'Take the offer if it clearly moves you closer to the career you want in 3–5 years. If the new role brings at least ~20% more salary, better learning, and teammates you respect, changing job is the right move.',
  },
  {
    question: 'Should we launch this new feature now or wait 3 months?',
    consensus: 76,
    synthesis:
      'Launch a focused MVP now instead of waiting. Ship the smallest version that delivers real value, learn from real users, and use the next 3 months to iterate quickly based on what they actually do.',
  },
  {
    question: 'Should we increase our SaaS prices by 20%?',
    consensus: 69,
    synthesis:
      'Test the 20% price increase instead of changing everything at once. Start with new customers and higher tiers, explain clearly what extra value they get, track churn and conversion, and adjust if you see strong pushback.',
  },
];

type Phase =
  | 'question'
  | 'sending'
  | 'sent'
  | 'consulting'
  | 'preparing'
  | 'consensus'
  | 'synthesis';

export function AnimatedDemo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const [visibleProviders, setVisibleProviders] = useState(0);
  const [statusLine, setStatusLine] = useState('');
  const [consensusPct, setConsensusPct] = useState(0);
  const [isSendPressed, setIsSendPressed] = useState(false);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const timersRef = useRef<number[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [restartToken, setRestartToken] = useState(0);

  const scene = SCENES[sceneIndex];
  const [typedQuestion, setTypedQuestion] = useState('');

  const consensusLabel = useMemo(() => {
    if (consensusPct >= 80) return 'Strong consensus';
    if (consensusPct >= 60) return 'General agreement';
    return 'Mixed opinions';
  }, [consensusPct]);

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };

  // Effet "saisie humaine" de la question pour la scène en cours.
  useEffect(() => {
    // Si la démo n'est pas visible, on ne tape rien.
    if (!isInView) {
      setTypedQuestion('');
      return;
    }

    const full = scene.question;
    setTypedQuestion('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTypedQuestion(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(id);
      }
    }, 32);

    return () => {
      window.clearInterval(id);
    };
  }, [sceneIndex, scene.question, isInView, restartToken]);

  // Master timeline: enchaîne proprement les phases pour chaque scène,
  // uniquement lorsque la démo est visible à l'écran.
  useEffect(() => {
    if (!isInView) {
      // Si ce n'est pas visible, on ne lance pas / on arrête tout.
      clearTimers();
      return;
    }

    clearTimers();
    setShowAllProviders(false);
    setVisibleProviders(0);
    setStatusLine('');
    setConsensusPct(0);
    setIsSendPressed(false);
    setPhase('question');

    const schedule = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      timersRef.current.push(id);
    };

    // Durée de frappe approximative de la question (un peu ralentie pour que tout soit plus lisible).
    const typingDuration = scene.question.length * 32 + 500;

    // 1) Question visible dès le départ, puis clic sur Send.
    // Laisser le temps de taper puis de "cliquer" proprement sans revenir en arrière.
    schedule(() => {
      setPhase('sending');
      setIsSendPressed(true);
    }, typingDuration);

    // Laisser le bouton se “cliquer”, puis transformer en bulle à droite (phase "sent"),
    // en se basant aussi sur typingDuration pour éviter que la question réapparaisse.
    schedule(() => {
      setIsSendPressed(false);
      setPhase('sent');
    }, typingDuration + 400);

    // 2) Consulting providers un par un (APRÈS que la bulle soit bien en place).
    // On laisse un peu plus de marge pour que la transition soit vraiment terminée.
    // Démarrer le consulting un peu plus tard pour que l'utilisateur ait le temps
    // de voir clairement la bulle se placer à droite.
    const consultingStartBase = typingDuration + 1300; // après clic + animation de la bulle (légèrement ralenti)
    PROVIDERS.forEach((provider, index) => {
      const labelTime = consultingStartBase + index * 900; // moment où on affiche "Consulting X..." (espacé un peu plus)
      const cardTime = labelTime + 460; // on laisse un peu plus de temps au texte avant de montrer la vignette

      // D'abord la phrase de consulting, sans vignette
      schedule(() => {
        setPhase('consulting');
        setStatusLine(`Consulting ${provider.name}…`);
      }, labelTime);

      // Ensuite la vignette de ce provider
      schedule(() => {
        setVisibleProviders(index + 1);
      }, cardTime);
    });

    // 3) Phase intermédiaire "Preparing your answer…" APRES la disparition
    // de la dernière vignette et AVANT l'apparition de la réponse.
    const lastLabelTime = consultingStartBase + (PROVIDERS.length - 1) * 900;
    const lastCardTime = lastLabelTime + 460;
    // On laisse un vrai moment pour que l'utilisateur voie
    // la dernière vignette, puis une pause douce avant "Preparing…".
    const afterConsulting = lastCardTime + 800;
    schedule(() => {
      // On fait disparaître les vignettes et on affiche uniquement la phrase.
      setVisibleProviders(0);
      setPhase('preparing');
      setStatusLine('Preparing your answer…');
    }, afterConsulting);

    // 4) Synthèse ManyMinds + animation du consensus.
    // On garde aussi un petit temps où il n'y a QUE "Preparing…"
    // avant de faire apparaître la réponse ManyMinds.
    const startSynthesis = afterConsulting + 1400;
    schedule(() => {
      // Le texte "Preparing your answer…" reste affiché
      // jusqu'au moment précis où le pourcentage commence à tourner,
      // puis on le retire.
      setPhase('synthesis');
      setStatusLine('');
      const target = scene.consensus;
      const durationMs = 1300; // progression du cercle un peu plus lente
      const startTime = performance.now();

      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setConsensusPct(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }, startSynthesis);

    // 6) Passer à la scène suivante après une pause.
    const startNextScene = startSynthesis + 3800; // petite pause plus longue sur la réponse finale
    schedule(() => {
      setSceneIndex((prev) => (prev + 1) % SCENES.length);
      setPhase('question');
    }, startNextScene);

    return () => clearTimers();
  }, [sceneIndex, scene.consensus, isInView, restartToken]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - consensusPct / 100);

  // Observe la section pour démarrer/arrêter la démo selon la visibilité.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        if (visible) {
          // Quand on revient sur la section, on repart proprement du début.
          setSceneIndex(0);
          setPhase('question');
          setShowAllProviders(false);
          setTypedQuestion('');
          setRestartToken((t) => t + 1);
          setIsInView(true);
        } else {
          // Quand on quitte la section, on arrête tout et on remet l'état initial.
          setIsInView(false);
          clearTimers();
          setVisibleProviders(0);
          setStatusLine('');
          setConsensusPct(0);
          setIsSendPressed(false);
          setShowAllProviders(false);
          setTypedQuestion('');
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: [0, 0.25],
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <div className="-mx-6 -mt-6 mb-5 flex items-center justify-between rounded-t-2xl bg-neutral-950 px-5 py-3">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="ManyMinds" className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide text-white/90">ManyMinds</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Question + bouton Send */}
        <AnimatePresence mode="wait" initial={false}>
          {(phase === 'question' || phase === 'sending') && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="space-y-2"
            >
              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                <div className="mb-1 text-[11px] font-semibold tracking-wide text-neutral-500">
                  Question
                </div>
                <p className="text-sm text-neutral-900">{typedQuestion}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-800">
                  {phase === 'sending' ? 'Sending…' : 'Type your question…'}
                </div>
                <motion.button
                  type="button"
                  aria-label="Send question"
                  animate={phase === 'sending' ? { scale: 0.95 } : { scale: 1 }}
                  transition={{ duration: 0.12 }}
                  className="rounded-xl bg-[#0a0a08] px-4 py-2 text-sm font-semibold text-white"
                >
                  Send
                </motion.button>
              </div>
            </motion.div>
          )}

          {phase !== 'question' && phase !== 'sending' && (
            // Après envoi: la question glisse en douceur vers la droite comme une bulle utilisateur.
            <motion.div
              key="bubble"
              initial={{ opacity: 0, x: -24, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -12, scale: 0.99 }}
              transition={{ duration: 0.4, ease: [0.23, 0.92, 0.35, 1] }}
              className="flex justify-end"
            >
              <div className="max-w-[80%] rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-900 shadow-sm">
                {scene.question}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Réponses des IA + texte de statut */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-neutral-800">
            {phase === 'consulting'
              ? statusLine || 'Consulting models…'
              : phase === 'preparing'
              ? statusLine
              : ''}
          </div>

          {phase === 'consulting' &&
            PROVIDERS.slice(0, visibleProviders).map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-neutral-100 bg-neutral-50 p-3"
                style={{ borderLeftWidth: 3, borderLeftColor: p.color }}
              >
                <span className="text-xs font-semibold text-neutral-500">{p.name}</span>
                <p className="mt-1 text-sm text-neutral-700">
                  {sceneIndex === 0 && p.name === 'Claude' && 'Focus on long‑term growth and clear responsibilities.'}
                  {sceneIndex === 0 && p.name === 'ChatGPT' && 'The offer is attractive if it adds at least 20% salary and better learning.'}
                  {sceneIndex === 0 && p.name === 'Gemini' && 'Culture, team, and manager fit are decisive.'}
                  {sceneIndex === 0 && p.name === 'DeepSeek' && 'Use the offer as leverage with your current employer before deciding.'}
                  {sceneIndex === 0 && p.name === 'Perplexity' && 'Validate assumptions quickly with up-to-date research and data.'}
                  {sceneIndex === 0 && p.name === 'Grok' && 'If you feel energized by the new role, that is a strong signal.'}

                  {sceneIndex === 1 && p.name === 'Claude' && 'Ship a smaller MVP now to validate demand.'}
                  {sceneIndex === 1 && p.name === 'ChatGPT' && 'Waiting 3 months delays learning and revenue.'}
                  {sceneIndex === 1 && p.name === 'Gemini' && 'Align launch with a clear success metric and tracking.'}
                  {sceneIndex === 1 && p.name === 'DeepSeek' && 'Protect your core roadmap: do not over‑scope the first version.'}
                  {sceneIndex === 1 && p.name === 'Perplexity' && 'Compare alternatives using recent market benchmarks before committing.'}
                  {sceneIndex === 1 && p.name === 'Grok' && 'If your users are already asking for it, waiting adds risk.'}

                  {sceneIndex === 2 && p.name === 'Claude' && 'A 20% increase is reasonable if value clearly justifies it.'}
                  {sceneIndex === 2 && p.name === 'ChatGPT' && 'Test price sensitivity with a subset of customers first.'}
                  {sceneIndex === 2 && p.name === 'Gemini' && 'Communicate the reasons for the change transparently.'}
                  {sceneIndex === 2 && p.name === 'DeepSeek' && 'Consider adding more value (features, support) for higher tiers.'}
                  {sceneIndex === 2 && p.name === 'Perplexity' && 'Use current competitor pricing and churn signals to set the right target.'}
                  {sceneIndex === 2 && p.name === 'Grok' && 'Cheap rarely signals “best in class” — pricing is part of your brand.'}
                </p>
              </motion.div>
            ))}
        </div>

        {phase === 'synthesis' && (
          <motion.div
            key="synthesis-card"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.3, 1] }}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-neutral-900">ManyMinds answer</div>
                <div className="text-[11px] text-neutral-500">
                  How confident this answer is about your situation
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative grid place-items-center">
                  <svg width="44" height="44" viewBox="0 0 44 44" className="block">
                    <circle
                      cx="22"
                      cy="22"
                      r={radius}
                      fill="none"
                      stroke="rgba(0,0,0,0.08)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="22"
                      cy="22"
                      r={radius}
                      fill="none"
                      stroke="rgb(139 92 246)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 22 22)"
                    />
                  </svg>
                  <div className="absolute text-[11px] font-extrabold leading-none text-neutral-900 tabular-nums">
                    {consensusPct}%
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-neutral-800">{scene.synthesis}</p>
            <button
              type="button"
              onClick={() => setShowAllProviders((v) => !v)}
              className="mt-3 text-xs font-semibold text-violet-700 hover:text-violet-800"
            >
              {showAllProviders ? 'Hide the AI answers' : 'View the AI answers'}
            </button>
          </motion.div>
        )}

        {phase === 'synthesis' && showAllProviders && (
          <motion.div
            key="providers-after"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 space-y-3"
          >
            {PROVIDERS.map((p, i) => (
              <motion.div
                key={`${p.name}-after`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-neutral-100 bg-neutral-50 p-3"
                style={{ borderLeftWidth: 3, borderLeftColor: p.color }}
              >
                <span className="text-xs font-semibold text-neutral-500">{p.name}</span>
                <p className="mt-1 text-sm text-neutral-700">
                  {sceneIndex === 0 && p.name === 'Claude' && 'Focus on long‑term growth and clear responsibilities.'}
                  {sceneIndex === 0 && p.name === 'ChatGPT' && 'The offer is attractive if it adds at least 20% salary and better learning.'}
                  {sceneIndex === 0 && p.name === 'Gemini' && 'Culture, team, and manager fit are decisive.'}
                  {sceneIndex === 0 && p.name === 'DeepSeek' && 'Use the offer as leverage with your current employer before deciding.'}
                  {sceneIndex === 0 && p.name === 'Perplexity' && 'Validate assumptions quickly with up-to-date research and data.'}
                  {sceneIndex === 0 && p.name === 'Grok' && 'If you feel energized by the new role, that is a strong signal.'}

                  {sceneIndex === 1 && p.name === 'Claude' && 'Ship a smaller MVP now to validate demand.'}
                  {sceneIndex === 1 && p.name === 'ChatGPT' && 'Waiting 3 months delays learning and revenue.'}
                  {sceneIndex === 1 && p.name === 'Gemini' && 'Align launch with a clear success metric and tracking.'}
                  {sceneIndex === 1 && p.name === 'DeepSeek' && 'Protect your core roadmap: do not over‑scope the first version.'}
                  {sceneIndex === 1 && p.name === 'Perplexity' && 'Compare alternatives using recent market benchmarks before committing.'}
                  {sceneIndex === 1 && p.name === 'Grok' && 'If your users are already asking for it, waiting adds risk.'}

                  {sceneIndex === 2 && p.name === 'Claude' && 'A 20% increase is reasonable if value clearly justifies it.'}
                  {sceneIndex === 2 && p.name === 'ChatGPT' && 'Test price sensitivity with a subset of customers first.'}
                  {sceneIndex === 2 && p.name === 'Gemini' && 'Communicate the reasons for the change transparently.'}
                  {sceneIndex === 2 && p.name === 'DeepSeek' && 'Consider adding more value (features, support) for higher tiers.'}
                  {sceneIndex === 2 && p.name === 'Perplexity' && 'Use current competitor pricing and churn signals to set the right target.'}
                  {sceneIndex === 2 && p.name === 'Grok' && 'Cheap rarely signals “best in class” — pricing is part of your brand.'}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}