import type { DocumentSnapshot } from "./document-schema";
export type { DocumentSnapshot } from "./document-schema";

export const MAX_PDF_BYTES = 3 * 1024 * 1024;
export type HistorySummary = {
  id: string; createdAt: string; filename: string; company: string;
  billNo: string; challanNo: string; docType: DocumentSnapshot["docType"];
  templateName: string; total: number; pageCount: number; sourceId?: string; deletedAt?: string;
};
export type HistoryEntry = HistorySummary & { snapshot: DocumentSnapshot; pdfBase64: string };
export const historySortLabels = {
  newest: "Newest first", oldest: "Oldest first", "customer-asc": "Customer: A to Z",
  "customer-desc": "Customer: Z to A", "number-asc": "Document: A to Z", "number-desc": "Document: Z to A",
  "amount-desc": "Amount: High to low", "amount-asc": "Amount: Low to high",
} as const;
export type HistorySort = keyof typeof historySortLabels;
export type HistoryFilters = { q: string; from: string; to: string; sort: HistorySort; docType: "all" | "bill" | "challan" | "both"; pageSize: number; view: "active" | "trash" };
export type HistoryPage = { entries: HistorySummary[]; page: number; pageSize: number; total: number; totalPages: number; activeCount: number; trashCount: number; filters: HistoryFilters };
export function isHistoryDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function normalizeHistoryFilters(input: Partial<Record<keyof HistoryFilters, unknown>> = {}): HistoryFilters {
  const from = typeof input.from === "string" && isHistoryDate(input.from) ? input.from : "";
  const to = typeof input.to === "string" && isHistoryDate(input.to) ? input.to : "";
  return {
    q: typeof input.q === "string" ? input.q.trim().slice(0, 200) : "", from, to,
    sort: typeof input.sort === "string" && Object.hasOwn(historySortLabels, input.sort) ? input.sort as HistorySort : "newest",
    docType: input.docType === "bill" || input.docType === "challan" || input.docType === "both" ? input.docType : "all",
    pageSize: [10, 25, 50].includes(Number(input.pageSize)) ? Number(input.pageSize) : 10,
    view: input.view === "trash" ? "trash" : "active",
  };
}
export function historyHref(filters: HistoryFilters, page = 1) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.sort !== "newest") query.set("sort", filters.sort);
  if (filters.docType !== "all") query.set("docType", filters.docType);
  if (filters.pageSize !== 10) query.set("pageSize", String(filters.pageSize));
  if (filters.view === "trash") query.set("view", "trash");
  if (page > 1) query.set("page", String(page));
  return `/history${query.size ? `?${query}` : ""}`;
}

export const documentTypeLabels = { bill: "Bill", challan: "Challan", both: "Bill + Challan" };
export function formatBangladeshTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(new Date(value)) + " BST (UTC+6)";
}
export function bangladeshDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
export function documentFilename(snapshot: Pick<DocumentSnapshot, "docType" | "billNo" | "challanNo">) {
  const number = snapshot.docType === "challan" ? snapshot.challanNo : snapshot.billNo;
  return `Dream-Sourcing-${number.replace(/[^a-z0-9_-]+/gi, "-") || "Document"}.pdf`;
}
export function paginateHistory(entries: HistorySummary[], requestedPage: number, pageSize = 10, input: Partial<HistoryFilters> = {}): HistoryPage {
  const filters = normalizeHistoryFilters({ ...input, pageSize });
  const activeCount = entries.filter(entry => !entry.deletedAt).length;
  const trashCount = entries.length - activeCount;
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00+06:00`) : -Infinity;
  const until = filters.to ? Date.parse(`${filters.to}T00:00:00+06:00`) + 86400000 : Infinity;
  const query = filters.q.toLocaleLowerCase("en");
  const compareText = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
  const ordered = entries.filter(entry => {
    if (Boolean(entry.deletedAt) !== (filters.view === "trash")) return false;
    if (filters.docType !== "all" && entry.docType !== filters.docType) return false;
    const saved = Date.parse(entry.createdAt);
    return saved >= from && saved < until && (!query || [entry.company, entry.billNo, entry.challanNo, entry.templateName].some(value => value.toLocaleLowerCase("en").includes(query)));
  }).sort((a, b) => {
    let comparison = 0;
    if (filters.sort === "newest" || filters.sort === "oldest") comparison = a.createdAt.localeCompare(b.createdAt) * (filters.sort === "newest" ? -1 : 1);
    else if (filters.sort.startsWith("customer")) comparison = compareText(a.company, b.company) * (filters.sort === "customer-desc" ? -1 : 1);
    else if (filters.sort.startsWith("number")) comparison = compareText(a.docType === "challan" ? a.challanNo : a.billNo, b.docType === "challan" ? b.challanNo : b.billNo) * (filters.sort === "number-desc" ? -1 : 1);
    else {
      if ((a.docType === "challan") !== (b.docType === "challan")) return a.docType === "challan" ? 1 : -1;
      comparison = (a.total - b.total) * (filters.sort === "amount-desc" ? -1 : 1);
    }
    return comparison || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
  });
  pageSize = filters.pageSize;
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  return { entries: ordered.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: ordered.length, totalPages, activeCount, trashCount, filters };
}
