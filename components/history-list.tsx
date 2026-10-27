"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, FileText, Pencil } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { Button } from "@/components/ui/button";
import { documentTypeLabels, formatBangladeshTime, type HistoryPage } from "@/lib/document-history";
import { money } from "@/lib/invoice-layout";

export function HistoryList({ history }: { history: HistoryPage }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function download(id: string, filename: string) {
    setDownloading(id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/history/${id}/pdf`, { cache: "no-store", credentials: "same-origin" });
      if (response.status === 401) { window.location.replace("/login?expired=1"); return; }
      if (!response.ok) throw new Error("The saved PDF could not be downloaded. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice(`PDF download started. Saved in history. ${formatBangladeshTime(new Date())}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Download failed."); }
    finally { setDownloading(null); }
  }
  const start = (history.page - 1) * history.pageSize;
  const pageNumbers = Array.from(new Set([1, history.page - 1, history.page, history.page + 1, history.totalPages]))
    .filter(page => page >= 1 && page <= history.totalPages).sort((a, b) => a - b);
  return <main className="history-shell">
    <header className="app-header"><AppBrand/><Link className="account-link ml-auto" href="/account">Account</Link></header>
    <div className="history-navigation"><WorkspaceNavigation history/></div>
    <section className="history-panel">
      <div className="history-heading"><div><h2>Document history</h2><p>Your saved bills and challans. All times are Bangladesh time (UTC+6).</p></div><Button asChild><Link href="/"><FileText size={16} /> Create document</Link></Button></div>
      <div className="history-feedback" aria-live="polite">{notice && <p role="status" className="auth-success">{notice}</p>}{error && <p role="alert" className="auth-error">{error}</p>}</div>
      {history.total === 0 ? <div className="history-empty"><FileText size={36} /><h3>No saved documents yet</h3><p>Generate a PDF from the workspace to save it here with its editable details.</p><Link href="/">Create your first document</Link></div> : <>
        <div className="history-table-wrap"><table className="history-table"><caption className="sr-only">Saved documents, newest first</caption><thead><tr><th scope="col">Document</th><th scope="col">Customer</th><th scope="col">Saved in Bangladesh time</th><th scope="col">Amount</th><th scope="col">Actions</th></tr></thead><tbody>{history.entries.map(entry => <tr key={entry.id}>
          <td><strong>{entry.docType === "challan" ? entry.challanNo : entry.billNo}</strong><span>{documentTypeLabels[entry.docType]} / {entry.pageCount} {entry.pageCount === 1 ? "page" : "pages"}</span>{entry.docType === "both" && <span>Challan: {entry.challanNo}</span>}{entry.sourceId && <span className="history-revision">Edited copy</span>}</td>
          <td><strong>{entry.company}</strong><span>{entry.templateName}</span></td>
          <td><time dateTime={entry.createdAt}>{formatBangladeshTime(entry.createdAt)}</time></td>
          <td className="history-amount">{entry.docType === "challan" ? "—" : `Tk ${money(entry.total)}`}</td>
          <td><div className="history-actions"><Button variant="outline" size="sm" asChild><Link href={`/?history=${entry.id}`}><Pencil size={14} /> Edit</Link></Button><Button size="sm" disabled={downloading !== null} onClick={() => download(entry.id, entry.filename)}><Download size={14} /> {downloading === entry.id ? "Downloading…" : "Download"}</Button></div></td>
        </tr>)}</tbody></table></div>
        <nav className="history-pagination" aria-label="Document history pagination"><p>Showing {start + 1}–{Math.min(start + history.pageSize, history.total)} of {history.total} documents</p><div>
          {history.page > 1 ? <Link href={`/history?page=${history.page - 1}`} aria-label="Previous page">Previous</Link> : <span aria-disabled="true">Previous</span>}
          {pageNumbers.map((page, index) => <span className="history-page-group" key={page}>{index > 0 && page > pageNumbers[index - 1] + 1 && <span aria-hidden="true">…</span>}<Link href={`/history?page=${page}`} aria-label={`Page ${page}`} aria-current={page === history.page ? "page" : undefined}>{page}</Link></span>)}
          {history.page < history.totalPages ? <Link href={`/history?page=${history.page + 1}`} aria-label="Next page">Next</Link> : <span aria-disabled="true">Next</span>}
        </div></nav>
      </>}
    </section>
  </main>;
}
