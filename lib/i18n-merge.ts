/**
 * Fusionne les messages d’une locale avec l’anglais : chaque clé présente dans `locale`
 * remplace la valeur EN, les clés absentes gardent la valeur EN.
 * Évite l’affichage brut du type `debate.viewModelAnswers` si une traduction manque.
 */
export function mergeMessagesWithEnglishFallback<
  T extends Record<string, unknown>,
>(english: T, locale: Partial<T> | null | undefined): T {
  if (!locale) return english;
  const out = { ...english };
  for (const key of Object.keys(locale) as (keyof T)[]) {
    const enVal = english[key];
    const locVal = locale[key];
    if (
      locVal !== undefined &&
      locVal !== null &&
      typeof locVal === 'object' &&
      !Array.isArray(locVal) &&
      enVal !== null &&
      typeof enVal === 'object' &&
      !Array.isArray(enVal)
    ) {
      out[key] = mergeMessagesWithEnglishFallback(
        enVal as Record<string, unknown>,
        locVal as Record<string, unknown>
      ) as T[keyof T];
    } else if (locVal !== undefined) {
      out[key] = locVal as T[keyof T];
    }
  }
  return out;
}
