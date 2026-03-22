'use client';

type Props = {
  iso: string | undefined | null;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
};

/**
 * Affiche une date courte en fuseau local sans erreur d’hydratation :
 * Node (SSR) et le navigateur peuvent formater différemment la même ISO.
 */
export function HydrationSafeDate({
  iso,
  locale = 'en-US',
  options = { month: 'short', day: 'numeric', year: 'numeric' },
}: Props) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <span suppressHydrationWarning>
      {d.toLocaleDateString(locale, options)}
    </span>
  );
}
