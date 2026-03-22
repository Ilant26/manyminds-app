/**
 * Nettoie le texte renvoyé par les APIs (Perplexity, etc.) pour l’affichage :
 * citations [1][2], coupures de ligne parasites.
 */

const HEADING_LINE = /^#{1,6}\s+\S/;
const BULLET_LINE = /^[-*]\s+\S/;
/** Liste numérotée en début de ligne (évite "2024. année") */
const NUMBERED_LINE = /^\d{1,3}\.\s+\S/;

function isStructuralLine(trimmed: string): boolean {
  if (!trimmed) return false;
  return (
    HEADING_LINE.test(trimmed) ||
    BULLET_LINE.test(trimmed) ||
    NUMBERED_LINE.test(trimmed)
  );
}

/**
 * Retire les renvois de sources [1], [2][3] sans casser les liens markdown [texte](url).
 */
export function stripInlineCitationMarkers(text: string): string {
  return text.replace(/\[\d+\](?!\()/g, '');
}

/**
 * Dans un bloc séparé par des lignes vides, fusionne les simples \n en espaces
 * (prose coupée artificiellement), en préservant titres / listes.
 */
export function mergeSoftLineBreaksInParagraph(paragraph: string): string {
  const lines = paragraph.split('\n');
  const out: string[] = [];
  let buf = '';

  const flushBuf = () => {
    const t = buf.trim();
    if (t) out.push(t);
    buf = '';
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      flushBuf();
      continue;
    }
    if (isStructuralLine(trimmed)) {
      flushBuf();
      out.push(trimmed);
      continue;
    }
    buf = buf ? `${buf} ${trimmed}` : trimmed;
  }
  flushBuf();
  return out.join('\n');
}

/**
 * Normalise \r\n, retire citations, fusionne les coupures de ligne « douces ».
 */
export function preprocessReadableModelText(text: string): string {
  let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/\u00a0/g, ' ');
  s = stripInlineCitationMarkers(s);
  // Paragraphes = blocs séparés par une ligne vide ou plus
  const parts = s.split(/\n{2,}/);
  const merged = parts.map((p) => mergeSoftLineBreaksInParagraph(p)).filter(Boolean);
  s = merged.join('\n\n');
  // Espaces multiples restants (ex. après suppression de citations)
  s = s.replace(/[ \t]{2,}/g, ' ');
  return s.trim();
}
