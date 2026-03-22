'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SignedIn, SignedOut, UserButton, useAuth, useUser } from '@clerk/nextjs';
import { MessageCircle, Clock3, Folder, Crown, User } from 'lucide-react';
import { useQuota } from '@/hooks/useQuota';
import { useState, useSyncExternalStore } from 'react';
import { PlanBillingModal } from '@/components/shared/PlanBillingModal';
import { FreeAccountModal } from '@/components/shared/FreeAccountModal';
import type { Plan } from '@/types';
import { stripOptionalLocalePrefix, withOptionalLocalePrefix } from '@/lib/utils';

const MM_CHAT_FULLSCREEN_CLASS = 'mm-chat-fullscreen';

function subscribeMmChatFullscreen(callback: () => void) {
  const root = document.documentElement;
  const observer = new MutationObserver(callback);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function getMmChatFullscreenFromDom() {
  return document.documentElement.classList.contains(MM_CHAT_FULLSCREEN_CLASS);
}

export function Sidebar({
  collapsed = false,
  onToggle,
  plan,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  plan: Plan;
}) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  const pathForNav = stripOptionalLocalePrefix(pathname ?? '');
  const { used, limit, isAnonymous } = useQuota();
  const { isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const [showPlan, setShowPlan] = useState(false);
  const [showFreeAccount, setShowFreeAccount] = useState(false);
  const chatPanelFullscreen = useSyncExternalStore(
    subscribeMmChatFullscreen,
    getMmChatFullscreenFromDom,
    () => false
  );
  const showAuthSkeleton = !authLoaded;
  const accountLabel =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    'Account';

  const collapsedTooltipClass =
    'pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-xl border border-neutral-900 bg-neutral-950 px-3 py-1.5 text-center text-sm font-semibold text-neutral-100 shadow-xl ring-1 ring-neutral-800 opacity-0 transition-opacity duration-0 group-hover:opacity-100';

  const nav = [
    { href: '/chat', label: t('title'), icon: MessageCircle },
    { href: '/history', label: t('history'), icon: Clock3 },
    { href: '/projects', label: 'Projects', icon: Folder },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-dvh shrink-0 flex-col overflow-x-visible border-r border-neutral-200 bg-white transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-[168px]'
      } pointer-events-auto`}
    >
      <div className="flex min-h-0 flex-1 flex-col px-2 py-4">
        <nav
          className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-none ${
            collapsed ? 'items-center' : 'items-stretch'
          } overflow-x-visible`}
        >
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathForNav === href;
            const fullHref = withOptionalLocalePrefix(href, pathname ?? '');
            return (
              <a
                key={href}
                href={fullHref}
                title={collapsed ? undefined : label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`group relative z-10 flex cursor-pointer items-center rounded-2xl border-0 bg-transparent text-left text-sm font-medium no-underline transition ${
                  collapsed
                    ? 'h-11 w-11 justify-center'
                    : 'h-10 w-full justify-start gap-3 px-3'
                } ${
                  active ? 'bg-violet-600/10 text-violet-700' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <Icon className="pointer-events-none h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
                {collapsed && (
                  <span className={collapsedTooltipClass}>
                    {label}
                  </span>
                )}
              </a>
            );
          })}

          <button
            type="button"
            onClick={() => setShowPlan(true)}
            title={collapsed ? undefined : 'Plan'}
            aria-label="Plan"
            className={`group relative flex items-center rounded-2xl text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 ${
              collapsed ? 'h-11 w-11 justify-center' : 'h-10 w-full justify-start gap-3 px-3'
            }`}
          >
            <Crown className="h-5 w-5" />
            {!collapsed && <span className="truncate">Plan</span>}
            {collapsed && (
              <span className={collapsedTooltipClass}>
                Plan
              </span>
            )}
          </button>
        </nav>

        <div
          className={`mt-2 shrink-0 border-t border-neutral-100 pt-3 ${
            collapsed ? 'flex flex-col items-center' : 'flex flex-col items-stretch'
          }`}
        >
          {showAuthSkeleton ? (
            <div
              className={`flex items-center ${collapsed ? 'justify-center' : 'justify-start gap-3 px-2'}`}
              aria-hidden
            >
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-neutral-200" />
              {!collapsed ? (
                <div className="h-4 w-24 max-w-full animate-pulse rounded bg-neutral-200" />
              ) : null}
            </div>
          ) : (
            <>
              <SignedIn>
                <div
                  className={`group relative z-10 flex items-center ${collapsed ? 'justify-center' : 'justify-start gap-3 px-2'}`}
                >
                  <UserButton
                    afterSignOutUrl="/"
                    userProfileMode="modal"
                    appearance={{
                      elements: {
                        avatarBox: 'h-11 w-11 shadow-none ring-0',
                        userButtonTrigger: 'rounded-xl focus:shadow-none',
                        userButtonPopoverRootBox: 'z-[100]',
                        userButtonPopoverCard: 'shadow-xl',
                        userButtonPopoverMain: 'z-[100]',
                      },
                    }}
                  />
                  {!collapsed && (
                    <span className="min-w-0 truncate text-sm font-medium text-neutral-800">
                      {accountLabel}
                    </span>
                  )}
                  {collapsed && (
                    <span className={collapsedTooltipClass}>{accountLabel}</span>
                  )}
                </div>
              </SignedIn>
              <SignedOut>
                <button
                  type="button"
                  title={collapsed ? undefined : 'Anonymous'}
                  aria-label="Anonymous"
                  onClick={() => setShowFreeAccount(true)}
                  className={`group relative flex items-center ${collapsed ? 'justify-center' : 'justify-start gap-3 px-2'}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-none ring-0">
                    <User className="h-5 w-5" />
                  </div>
                  {!collapsed && (
                    <span className="truncate text-sm font-medium text-neutral-800">Anonymous</span>
                  )}
                  {collapsed && (
                    <span className={collapsedTooltipClass}>Anonymous</span>
                  )}
                </button>
              </SignedOut>
            </>
          )}
        </div>
      </div>

      {onToggle && !chatPanelFullscreen ? (
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-full top-1/2 z-[1001] -translate-y-1/2 rounded-l-none rounded-r-full bg-black px-1 py-5 shadow-md outline-none hover:bg-black/90 focus:outline-none focus-visible:outline-none"
          aria-label={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
        >
          <span className="block h-8 w-0.5 rounded-full bg-black" />
        </button>
      ) : null}

      <PlanBillingModal
        open={showPlan}
        onClose={() => setShowPlan(false)}
        plan={plan}
        used={used}
        limit={limit}
        isAnonymous={isAnonymous}
      />

      <FreeAccountModal open={showFreeAccount} onClose={() => setShowFreeAccount(false)} />
    </aside>
  );
}
