export type ProjectListItem = { id: string; name: string; created_at: string };

export type ProjectsPageClientProps = {
  serverSignedIn: boolean;
  serverProjectsPrefetched: boolean;
  initialProjects: ProjectListItem[];
};
