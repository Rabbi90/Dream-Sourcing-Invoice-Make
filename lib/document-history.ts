import type { DocumentSnapshot } from "./document-schema";
export type { DocumentSnapshot } from "./document-schema";

export const MAX_PDF_BYTES = 3 * 1024 * 1024;
export type HistorySummary = {
  id: string; createdAt: string; filename: string; company: string;
  billNo: string; challanNo: string; docType: DocumentSnapshot["docType"];
  templateName: string; total: number; pageCount: number; sourceId?: string;
};
export type HistoryEntry = HistorySummary & { snapshot: DocumentSnapshot; pdfBase64: string };
export type HistoryPage = { entries: HistorySummary[]; page: number; pageSize: number; total: number; totalPages: number };

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
export function paginateHistory(entries: HistorySummary[], requestedPage: number, pageSize = 10): HistoryPage {
  const ordered = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  return { entries: ordered.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: entries.length, totalPages };
}
