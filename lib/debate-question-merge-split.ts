/**
 * Séparateur canonique quand le serveur fusionne les tours dans `debates.question`
 * (voir `app/api/debate/route.ts`).
 */
export const DEBATE_QUESTION_MERGE_SEP = '\n\n---\n\n';

/** Fragment inutile entre deux vraies questions (` --- ? --- `). */
function isJunkQuestionFragment(s: string): boolean {
  return /^[\s?!.,;:…]+$/u.test(s.trim());
}

/**
 * Tirets « typographiques » → ASCII, pour que ` –– — ` se comporte comme `---`.
 */
function normalizeThreadDashes(raw: string): string {
  return raw.replace(/[\u2013\u2014\u2212‐]/g, '-');
}

/**
 * Découpe `question` quand plusieurs messages utilisateur ont été fusionnés.
 */
export function splitMergedQuestionParts(raw: string | null | undefined): string[] {
  const s0 = (raw ?? '').trim();
  if (!s0) return [];

  const normalized = normalizeThreadDashes(s0);

  /**
   * 3+ tirets consécutifs = séparateur (produit ou copier-coller), avec espaces optionnels.
   * Passe avant les autres règles pour capter les variantes Unicode déjà normalisées.
   */
  const byRunOfHyphens = normalized
    .split(/\s*-{3,}\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !isJunkQuestionFragment(p));

  if (byRunOfHyphens.length >= 2) return byRunOfHyphens;

  const looseParts = (chunk: string): string[] =>
    chunk
      .split(/\s+---\s+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !isJunkQuestionFragment(p));

  const tightParts = (chunk: string): string[] =>
    chunk
      .split(/\s*---\s*/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !isJunkQuestionFragment(p));

  const canonical = normalized
    .split(DEBATE_QUESTION_MERGE_SEP)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !isJunkQuestionFragment(p));

  if (canonical.length >= 2) return canonical;

  if (canonical.length === 1) {
    const inner = looseParts(canonical[0]!);
    if (inner.length >= 2) return inner;
    const innerTight = tightParts(canonical[0]!);
    if (innerTight.length >= 2) return innerTight;
    return canonical;
  }

  const loose = looseParts(normalized);
  if (loose.length >= 2) return loose;

  const tight = tightParts(normalized);
  if (tight.length >= 2) return tight;

  return [s0];
}

/**
 * Message réduit à de la ponctuation « suite » sans mots : ?, ., …, espaces (réaction / relance implicite).
 */
export function isBareFollowUpSignal(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^[.?？…\s]+$/u.test(t);
}

/**
 * Dernière question « réelle » dans une chaîne fusionnée (ignore les tours réduits à « ? » / « . » seuls).
 */
export function lastSubstantiveUserQuestionFromMerged(merged: string | null | undefined): string {
  const parts = splitMergedQuestionParts(merged ?? '');
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]!.trim();
    if (p && !isBareFollowUpSignal(p)) return p;
  }
  if (parts.length > 0) return parts[parts.length - 1]!.trim();
  return (merged ?? '').trim();
}
