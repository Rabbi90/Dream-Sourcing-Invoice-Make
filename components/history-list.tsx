"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Download, FileText, LoaderCircle, Pencil, RotateCcw, Search, Trash2, X } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/client-api";
import { bangladeshDate, documentTypeLabels, formatBangladeshTime, historyHref, historySortLabels, normalizeHistoryFilters, type HistoryFilters, type HistoryPage, type HistorySort } from "@/lib/document-history";
import { money } from "@/lib/invoice-layout";

export function HistoryList({ history, csrfToken }: { history: HistoryPage; csrfToken: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState(history.filters);
  const [selected, setSelected] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const trash = history.filters.view === "trash";
  const selectedIds = selected.filter(id => history.entries.some(entry => entry.id === id));
  const allSelected = history.entries.length > 0 && selectedIds.length === history.entries.length;
  const busy = pending || changing;
  const filtered = Boolean(history.filters.q || history.filters.from || history.filters.to || history.filters.docType !== "all");

  function navigate(filters: HistoryFilters, page = 1) {
    setError(""); setSelected([]);
    startTransition(() => router.push(historyHref(filters, page), { scroll: false }));
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fields.from && fields.to && fields.from > fields.to) { setError("The start date must be on or before the end date."); return; }
    navigate(fields);
  }
  function quickRange(days: number) {
    const to = bangladeshDate();
    const date = new Date(`${to}T00:00:00+06:00`);
    date.setTime(date.getTime() - (days - 1) * 86400000);
    const filters = { ...fields, from: bangladeshDate(date), to };
    setFields(filters); navigate(filters);
  }
  async function download(id: string, filename: string) {
    if (downloading || busy) return;
    setDownloading(id); setError(""); setNotice(""); setUndoIds([]);
    try {
      const response = await fetch(`/api/history/${id}/pdf`, { cache: "no-store", credentials: "same-origin" });
      if (response.status === 401) { window.location.replace("/login?expired=1"); return; }
      if (!response.ok) throw new Error(response.status === 404 ? "This document is no longer available. Refresh history or check Trash." : "The saved PDF could not be downloaded. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice(`PDF download started. ${formatBangladeshTime(new Date())}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Download failed."); }
    finally { setDownloading(null); }
  }
  async function changeTrash(ids: string[], restore: boolean) {
    if (busy || downloading) return;
    setChanging(true); setError(""); setDialogError("");
    try {
      const result = await apiRequest<{ count: number }>("/api/history", { method: restore ? "PATCH" : "DELETE", body: { ids }, csrfToken });
      setNotice(`${result.count} ${result.count === 1 ? "document" : "documents"} ${restore ? "restored to history" : "moved to Trash"}.`);
      setUndoIds(restore ? [] : ids); setSelected([]); setDeleteIds([]);
      startTransition(() => router.refresh());
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The documents could not be updated. Please try again.";
      if (!restore) setDialogError(message); else setError(message);
    } finally { setChanging(false); }
  }
  function confirmDelete(ids: string[]) { setDialogError(""); setDeleteIds(ids); }
  function sortColumn(ascending: HistorySort, descending: HistorySort) {
    navigate({ ...history.filters, sort: history.filters.sort === ascending ? descending : ascending });
  }
  function sortDirection(ascending: HistorySort, descending: HistorySort): "ascending" | "descending" | "none" {
    return history.filters.sort === ascending ? "ascending" : history.filters.sort === descending ? "descending" : "none";
  }
  function sortIcon(ascending: HistorySort, descending: HistorySort) {
    return history.filters.sort === ascending ? <ArrowUp size={14}/> : history.filters.sort === descending ? <ArrowDown size={14}/> : <ArrowUpDown size={14}/>;
  }
  const start = (history.page - 1) * history.pageSize;
  const pageNumbers = Array.from(new Set([1, history.page - 1, history.page, history.page + 1, history.totalPages]))
    .filter(page => page >= 1 && page <= history.totalPages).sort((a, b) => a - b);

  return <main className="history-shell">
    <header className="app-header"><AppBrand/><Link className="account-link ml-auto" href="/account">Account</Link></header>
    <div className="history-navigation"><WorkspaceNavigation history/></div>
    <section className="history-panel history-advanced" aria-busy={pending}>
      <div className="history-heading"><div><h2>Document history</h2><p>Find a bill, download its original PDF, or pick up where you left off.</p></div><Button asChild><Link href="/"><FileText size={16}/> Create document</Link></Button></div>
      <div className="history-view-tabs" aria-label="History view">
        <Link href={historyHref({ ...history.filters, view: "active" })} aria-current={!trash ? "page" : undefined}><FileText size={16}/> Documents <span>{history.activeCount}</span></Link>
        <Link href={historyHref({ ...history.filters, view: "trash" })} aria-current={trash ? "page" : undefined}><Trash2 size={16}/> Trash <span>{history.trashCount}</span></Link>
      </div>
      <form className="history-filters" onSubmit={apply}>
        <fieldset disabled={busy}>
          <legend className="sr-only">Filter saved documents</legend>
          <label className="history-search">Search documents<div className="history-search-input"><Search size={17}/><input name="q" type="search" placeholder="Customer, bill, challan or template" maxLength={200} value={fields.q} onChange={event => setFields({ ...fields, q: event.target.value })}/></div></label>
          <div className="history-date-range"><span><CalendarDays size={15}/> Saved date · Bangladesh time</span><div><label>From<input aria-label="Saved from date" name="from" type="date" max={fields.to || "9999-12-31"} value={fields.from} onChange={event => setFields({ ...fields, from: event.target.value })}/></label><label>To<input aria-label="Saved to date" name="to" type="date" min={fields.from || "0001-01-01"} max="9999-12-31" value={fields.to} onChange={event => setFields({ ...fields, to: event.target.value })}/></label></div></div>
          <label>Document type<select value={fields.docType} onChange={event => setFields({ ...fields, docType: event.target.value as HistoryFilters["docType"] })}><option value="all">All types</option><option value="bill">Bill only</option><option value="challan">Challan only</option><option value="both">Bill + Challan</option></select></label>
          <Button type="submit">{pending ? <LoaderCircle className="animate-spin"/> : <Search size={16}/>} Apply filters</Button>
        </fieldset>
        <div className="history-filter-shortcuts"><span>Quick range</span><button type="button" disabled={busy} onClick={() => quickRange(1)}>Today</button><button type="button" disabled={busy} onClick={() => quickRange(7)}>Last 7 days</button><button type="button" disabled={busy} onClick={() => quickRange(30)}>Last 30 days</button>{filtered && <button type="button" className="history-clear" disabled={busy} onClick={() => navigate(normalizeHistoryFilters({ view: history.filters.view, sort: history.filters.sort, pageSize: history.pageSize }))}><X size={13}/> Clear filters</button>}</div>
      </form>
      <div className="history-feedback" aria-live="polite">{notice && <div className="auth-success history-notice" role="status"><span>{notice}</span>{undoIds.length > 0 && <button disabled={busy} onClick={() => changeTrash(undoIds, true)}>Undo</button>}<button aria-label="Dismiss notification" onClick={() => { setNotice(""); setUndoIds([]); }}><X size={16}/></button></div>}{error && <p role="alert" className="auth-error">{error}</p>}</div>
      <div className="history-results-bar"><div>{selectedIds.length ? <><strong>{selectedIds.length} selected</strong><button onClick={() => setSelected([])} disabled={busy}>Clear selection</button>{trash ? <Button size="sm" variant="outline" disabled={busy || !!downloading} onClick={() => changeTrash(selectedIds, true)}><RotateCcw size={14}/> Restore selected</Button> : <Button size="sm" variant="destructive" disabled={busy || !!downloading} onClick={() => confirmDelete(selectedIds)}><Trash2 size={14}/> Delete selected</Button>}</> : <><strong>{history.total} {history.total === 1 ? "document" : "documents"}</strong><span>{filtered ? "matching your filters" : trash ? "in Trash" : "saved in history"}</span></>}</div><label>Sort by<select aria-label="Sort history" value={history.filters.sort} disabled={busy} onChange={event => navigate({ ...history.filters, sort: event.target.value as HistorySort })}>{Object.entries(historySortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {history.total === 0 ? <div className="history-empty">{trash ? <Trash2 size={36}/> : <FileText size={36}/>}<h3>{filtered ? "No matching documents" : trash ? "Trash is empty" : "No saved documents yet"}</h3><p>{filtered ? "Try another customer, document type or saved-date range." : trash ? "Deleted documents appear here. You can restore them whenever you need." : "Generate a PDF from the workspace to save it here with its editable details."}</p>{filtered ? <Button variant="outline" onClick={() => navigate(normalizeHistoryFilters({ view: history.filters.view }))}>Clear filters</Button> : !trash && <Link href="/">Create your first document</Link>}</div> : <>
        <div className="history-table-wrap"><table className="history-table"><caption className="sr-only">{trash ? "Deleted documents available to restore" : "Saved bills and delivery challans"}</caption><thead><tr>
          <th scope="col" className="history-select-cell"><input type="checkbox" aria-label="Select all documents on this page" checked={allSelected} ref={node => { if (node) node.indeterminate = selectedIds.length > 0 && !allSelected; }} disabled={busy} onChange={event => setSelected(event.target.checked ? history.entries.map(entry => entry.id) : [])}/></th>
          <th scope="col" aria-sort={sortDirection("number-asc", "number-desc")}><button disabled={busy} onClick={() => sortColumn("number-asc", "number-desc")}>Document {sortIcon("number-asc", "number-desc")}</button></th>
          <th scope="col" aria-sort={sortDirection("customer-asc", "customer-desc")}><button disabled={busy} onClick={() => sortColumn("customer-asc", "customer-desc")}>Customer {sortIcon("customer-asc", "customer-desc")}</button></th>
          <th scope="col" aria-sort={sortDirection("oldest", "newest")}><button disabled={busy} onClick={() => sortColumn("oldest", "newest")}>Saved date {sortIcon("oldest", "newest")}</button><span className="history-timezone">Bangladesh · UTC+6</span></th>
          <th scope="col" aria-sort={sortDirection("amount-asc", "amount-desc")}><button disabled={busy} onClick={() => sortColumn("amount-asc", "amount-desc")}>Amount {sortIcon("amount-asc", "amount-desc")}</button></th>
          <th scope="col" className="history-action-heading">Actions</th>
        </tr></thead><tbody>{history.entries.map(entry => {
          const number = entry.docType === "challan" ? entry.challanNo : entry.billNo;
          return <tr key={entry.id} data-selected={selectedIds.includes(entry.id) ? "true" : undefined}>
            <td className="history-select-cell"><input type="checkbox" aria-label={`Select ${number}`} checked={selectedIds.includes(entry.id)} disabled={busy} onChange={event => setSelected(previous => event.target.checked ? [...previous, entry.id] : previous.filter(id => id !== entry.id))}/></td>
            <td><div className="history-document-cell"><span className="history-file-icon"><FileText size={20}/></span><div><strong>{number}</strong><span className={`history-kind history-kind-${entry.docType}`}>{documentTypeLabels[entry.docType]}</span><small>{entry.pageCount} {entry.pageCount === 1 ? "page" : "pages"}{entry.sourceId ? " / Edited copy" : ""}</small>{entry.docType === "both" && <small>Challan: {entry.challanNo}</small>}</div></div></td>
            <td><strong>{entry.company}</strong><span>{entry.templateName}</span></td>
            <td><time dateTime={entry.createdAt}>{formatBangladeshTime(entry.createdAt).replace(" BST (UTC+6)", "")}</time>{entry.deletedAt && <span>Deleted {formatBangladeshTime(entry.deletedAt).replace(" BST (UTC+6)", "")}</span>}</td>
            <td className="history-amount">{entry.docType === "challan" ? <span title="Delivery challans do not show monetary totals">—</span> : <><strong>Tk {money(entry.total)}</strong><span>Includes VAT</span></>}</td>
            <td><div className="history-actions">{trash ? <Button size="sm" variant="outline" disabled={busy} onClick={() => changeTrash([entry.id], true)}><RotateCcw size={14}/> Restore</Button> : <>
              <Button size="sm" title={`Download ${entry.filename}`} disabled={!!downloading || busy} onClick={() => download(entry.id, entry.filename)}>{downloading === entry.id ? <LoaderCircle size={14} className="animate-spin"/> : <Download size={14}/>} {downloading === entry.id ? "Downloading…" : "PDF"}</Button>
              <Button variant="outline" size="sm" asChild><Link href={`/?history=${entry.id}`} aria-label={`Edit ${number}`} title="Edit a copy"><Pencil size={14}/><span className="history-edit-label">Edit</span></Link></Button>
              <Button variant="ghost" size="icon-sm" className="history-delete-button" title="Move to Trash" aria-label={`Delete ${number}`} disabled={busy || !!downloading} onClick={() => confirmDelete([entry.id])}><Trash2 size={16}/></Button>
            </>}</div></td>
          </tr>;
        })}</tbody></table></div>
        <nav className="history-pagination" aria-label="Document history pagination"><div className="history-page-details"><p>Showing {start + 1}–{Math.min(start + history.pageSize, history.total)} of {history.total}</p><label>Rows<select aria-label="Rows per page" disabled={busy} value={history.pageSize} onChange={event => navigate({ ...history.filters, pageSize: Number(event.target.value) })}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div><div>
          {history.page > 1 ? <Link href={historyHref(history.filters, history.page - 1)} aria-label="Previous page">Previous</Link> : <span aria-disabled="true">Previous</span>}
          {pageNumbers.map((page, index) => <span className="history-page-group" key={page}>{index > 0 && page > pageNumbers[index - 1] + 1 && <span aria-hidden="true">…</span>}<Link href={historyHref(history.filters, page)} aria-label={`Page ${page}`} aria-current={page === history.page ? "page" : undefined}>{page}</Link></span>)}
          {history.page < history.totalPages ? <Link href={historyHref(history.filters, history.page + 1)} aria-label="Next page">Next</Link> : <span aria-disabled="true">Next</span>}
        </div></nav>
      </>}
      {trash && <p className="history-trash-note">Documents in Trash are kept for recovery. Restore a document to edit or download it again.</p>}
    </section>
    <AlertDialog open={deleteIds.length > 0} onOpenChange={open => { if (!open && !changing) setDeleteIds([]); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Move {deleteIds.length === 1 ? "this document" : `${deleteIds.length} documents`} to Trash?</AlertDialogTitle><AlertDialogDescription>The saved PDF and editable details will leave your document list. You can restore them from Trash.</AlertDialogDescription></AlertDialogHeader>{dialogError && <p role="alert" className="auth-error">{dialogError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={changing}>Cancel</AlertDialogCancel><Button variant="destructive" disabled={changing} onClick={() => changeTrash(deleteIds, false)}>{changing ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>} {changing ? "Moving…" : "Move to Trash"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
