import { NextRequest } from 'next/server';
import {
  buildSmartContext,
  formatPlainPartnerTurnsContext,
  type PartnerMemoryTurn,
} from '@/lib/linked-context-from-panel-snapshot';

function coerceTurns(raw: unknown): PartnerMemoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: PartnerMemoryTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const q = typeof o.question === 'string' ? o.question : '';
    const s = typeof o.synthesis === 'string' ? o.synthesis : '';
    out.push({ question: q, synthesis: s });
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ context: '' });
  }
  const turnsRaw =
    body && typeof body === 'object' && 'turns' in body
      ? (body as { turns: unknown }).turns
      : null;
  if (!turnsRaw || !Array.isArray(turnsRaw)) {
    return Response.json({ context: '' });
  }

  const turns = coerceTurns(turnsRaw);
  if (turns.length === 0) {
    return Response.json({ context: '' });
  }

  try {
    const context = await buildSmartContext(turns);
    return Response.json({ context });
  } catch {
    const plain = formatPlainPartnerTurnsContext(turns);
    return Response.json({ context: plain });
  }
}
