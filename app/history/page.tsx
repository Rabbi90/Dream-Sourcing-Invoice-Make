import { HistoryList } from "@/components/history-list";
import { requireSession } from "@/lib/server/auth";
import { getHistoryPage } from "@/lib/server/history";
import { normalizeHistoryFilters } from "@/lib/document-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const query = await searchParams;
  const history = await getHistoryPage(Number(query.page || 1), normalizeHistoryFilters(query));
  return <HistoryList key={JSON.stringify({ ...history.filters, page: history.page })} history={history} csrfToken={session.csrfToken} />;
}
