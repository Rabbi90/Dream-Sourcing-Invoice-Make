import { HistoryList } from "@/components/history-list";
import { requireSession } from "@/lib/server/auth";
import { getHistoryPage } from "@/lib/server/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireSession();
  const { page } = await searchParams;
  const history = await getHistoryPage(Number(page || 1));
  return <HistoryList history={history} />;
}
