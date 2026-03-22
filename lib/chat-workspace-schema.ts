import { z } from 'zod';

export const chatWorkspacePayloadSchema = z.object({
  v: z.number().int().optional(),
  panels: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        debateId: z.string().nullable().optional(),
        question: z.string().max(120_000).optional(),
        synthesis: z.string().nullable().optional(),
      })
    )
    .max(2),
  isSynced: z.boolean().optional(),
  panelSnapshots: z.record(z.string(), z.unknown()).optional(),
});

export type ChatWorkspacePayload = z.infer<typeof chatWorkspacePayloadSchema>;

const MAX_JSON_BYTES = 900_000;

export function parseWorkspacePayload(raw: unknown): ChatWorkspacePayload | null {
  const parsed = chatWorkspacePayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function assertWorkspaceBodySize(json: string): boolean {
  return new TextEncoder().encode(json).length <= MAX_JSON_BYTES;
}
