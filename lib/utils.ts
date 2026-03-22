import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Retire un préfixe de locale next-intl (`/fr/chat` → `/chat`). */
export function stripOptionalLocalePrefix(pathname: string): string {
  const path = (pathname.split('?')[0] ?? pathname).trim()
  const noTrailing = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  const m = /^\/(en|fr)(\/.*)$/.exec(noTrailing)
  return m?.[2] ?? noTrailing
}

/**
 * Préfixe la locale si l’URL actuelle en a une (`/fr` + `/chat` → `/fr/chat`).
 * Utilisé pour les liens `<a href>` (navigation dure = fiable même si React est saturé).
 */
export function withOptionalLocalePrefix(href: string, pathname: string): string {
  const path = (pathname.split('?')[0] ?? pathname).trim()
  const noTrailing = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  const m = /^\/(en)(?=\/|$)/.exec(noTrailing)
  const locale = m?.[1]
  if (!locale || !href.startsWith('/')) return href
  if (href === '/') return `/${locale}`
  return `/${locale}${href}`
}

/** `/chat`, `/chat/`, query string ignorée — même logique partout (chat vs autres pages dashboard). */
export function isChatRoutePath(pathname: string): boolean {
  const normalized = stripOptionalLocalePrefix(pathname)
  return normalized === '/chat'
}
