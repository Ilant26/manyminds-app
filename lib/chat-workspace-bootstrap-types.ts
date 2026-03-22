/** Données workspace chat sérialisables, passées du layout serveur au client (hydratation). */
export type ChatWorkspaceSsrBootstrap = {
  panels: Array<{
    id: string;
    debateId: string | null;
    question: string;
    synthesis: string | null;
  }>;
  isSynced: boolean;
  panelSnapshots?: Record<string, unknown>;
};
