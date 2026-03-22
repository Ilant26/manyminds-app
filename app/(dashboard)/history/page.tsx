import HistoryPageClient from './HistoryPageClient';
import { loadHistoryPageData } from './load-history-page-data';

export default async function HistoryPage() {
  const props = await loadHistoryPageData();
  return <HistoryPageClient {...props} />;
}
