import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { documentFilename, paginateHistory, type DocumentSnapshot, type HistoryEntry, type HistorySummary, type HistoryFilters } from "../document-history";
import { deleteRecord, readRecord, writeRecord } from "./store";
import { RequestError } from "./http";

const indexKey = "history/index";
const entryKey = (id: string) => `history/documents/${id}`;
export async function getHistoryEntry(id: string): Promise<HistoryEntry> {
  if (!z.string().uuid().safeParse(id).success) throw new RequestError(404, "Saved document not found.");
  const index = await readRecord<HistorySummary[]>(indexKey);
  if (!index?.value.some(entry => entry.id === id && !entry.deletedAt)) throw new RequestError(404, "Saved document not found. It may be in Trash.");
  const entry = await readRecord<HistoryEntry>(entryKey(id));
  if (!entry) throw new RequestError(404, "Saved document not found.");
  return entry.value;
}
export async function getHistoryPage(page = 1, filters: Partial<HistoryFilters> = {}) {
  const index = await readRecord<HistorySummary[]>(indexKey);
  return paginateHistory(index?.value ?? [], page, filters.pageSize ?? 10, filters);
}
export async function setHistoryTrash(ids: string[], trash: boolean) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await readRecord<HistorySummary[]>(indexKey);
    if (!current || ids.some(id => !current.value.some(entry => entry.id === id))) throw new RequestError(404, "A selected document no longer exists. Refresh history and try again.");
    const selected = new Set(ids);
    const deletedAt = new Date().toISOString();
    const updated = current.value.map(entry => {
      if (!selected.has(entry.id)) return entry;
      const result = { ...entry };
      if (trash) result.deletedAt = result.deletedAt ?? deletedAt;
      else delete result.deletedAt;
      return result;
    });
    if (await writeRecord(indexKey, updated, current.etag)) return { count: ids.length };
  }
  throw new RequestError(409, "History changed in another tab. Please try again.");
}
export async function saveHistory(snapshot: DocumentSnapshot, pdfBase64: string, pageCount: number, sourceId?: string) {
  if (sourceId) {
    try { await getHistoryEntry(sourceId); }
    catch (error) { if (error instanceof RequestError && error.status === 404) sourceId = undefined; else throw error; }
  }
  const subtotal = snapshot.lines.reduce((sum, row) => sum + row.qty * row.price, 0);
  const summary: HistorySummary = {
    id: randomUUID(), createdAt: new Date().toISOString(), filename: documentFilename(snapshot),
    company: snapshot.company, billNo: snapshot.billNo, challanNo: snapshot.challanNo,
    docType: snapshot.docType, templateName: snapshot.template.name,
    total: subtotal * (1 + snapshot.template.vatRate / 100), pageCount,
    ...(sourceId ? { sourceId } : {}),
  };
  if (!await writeRecord(entryKey(summary.id), { ...summary, snapshot, pdfBase64 }, null)) throw new Error("History save failed.");
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await readRecord<HistorySummary[]>(indexKey);
    if (await writeRecord(indexKey, [summary, ...(current?.value ?? [])], current?.etag ?? null)) return summary;
  }
  // Only clean up confirmed conflicts. A network error may occur after an
  // index commit; deleting the PDF then would break a successfully saved entry.
  await deleteRecord(entryKey(summary.id));
  throw new RequestError(409, "History is busy. Please generate the PDF again.");
}
