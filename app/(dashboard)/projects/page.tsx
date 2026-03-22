import ProjectsPageClient from './ProjectsPageClient';
import { loadProjectsPageData } from './load-projects-page-data';

export default async function ProjectsPage() {
  const props = await loadProjectsPageData();
  return <ProjectsPageClient {...props} />;
}
