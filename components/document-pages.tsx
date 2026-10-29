"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { TermsContent } from "@/components/terms-editor";
import { labels, money, paginateRows, type Line, type Template, type WidthKey } from "@/lib/invoice-layout";

type DocumentProps = {
  kind: "bill" | "challan"; pageMode: "split" | "single"; template: Template; lines: Line[];
  company: string; address: string; contact: string; po: string;
  number: string; date: string; subtotal: number; vat: number; total: number;
};
type Layout = { source: DocumentProps; pages: number[][]; widths: number[]; scale: number; error: string };

export function DocumentPages(props: DocumentProps) {
  const measurement = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [fontRevision, setFontRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const update = () => { if (active) setFontRevision(value => value + 1); };
    document.fonts.ready.then(update);
    document.fonts.addEventListener("loadingdone", update);
    return () => { active = false; document.fonts.removeEventListener("loadingdone", update); };
  }, []);

  useLayoutEffect(() => {
    const paper = measurement.current;
    if (!paper) return;
    const measure = () => {
      const table = paper.querySelector("table")!;
      const body = paper.querySelector(".document-body")!;
      if (paper.getBoundingClientRect().width === 0) return;
      const cols = Array.from(table.querySelectorAll("col"));
      // First recover the original automatic widths using the complete table.
      table.style.tableLayout = "auto";
      cols.forEach(col => { col.style.width = ""; });
      const cells = Array.from(table.tHead!.rows[0].cells);
      const natural = cells.map(cell => cell.getBoundingClientRect().width);
      const keys: WidthKey[] = ["serial", ...visibleColumns(props)];
      const overrides = keys.map(key => props.template.columnWidths?.[key]);
      const specified = overrides.reduce<number>((sum, value) => sum + (value || 0), 0);
      const automatic = natural.reduce((sum, width, index) => sum + (overrides[index] ? 0 : width), 0);
      const totalNatural = natural.reduce((sum, width) => sum + width, 0);
      const widths = natural.map((width, index) => {
        if (!specified) return width / totalNatural * 100;
        if (!automatic || specified >= 100) return (overrides[index] || 0) / specified * 100;
        return overrides[index] || width / automatic * (100 - specified);
      });
      table.style.tableLayout = "fixed";
      cols.forEach((col, index) => { col.style.width = `${widths[index]}%`; });
      // Reserve a small rounding allowance at the bottom in addition to the
      // separate 40px signature gap laid out by CSS.
      const capacity = body.getBoundingClientRect().bottom - table.getBoundingClientRect().top - table.tHead!.getBoundingClientRect().height - 3;
      let scale = 1;
      if (props.pageMode === "single") {
        // Measure the actual wrapped text at every size. Never clip rows to force a page.
        for (const candidate of [1, .95, .9, .85, .8, .75, .7, .65]) {
          paper.style.setProperty("--compact-scale", String(candidate));
          const rowsHeight = Array.from(table.tBodies[0].rows).reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
          const totalHeight = (table.tFoot?.getBoundingClientRect().height || 0) + (paper.querySelector(".document-terms")?.getBoundingClientRect().height || 0);
          scale = candidate;
          if (rowsHeight + totalHeight <= capacity && Array.from(table.querySelectorAll("th,td")).every(cell => cell.scrollWidth <= cell.clientWidth + 2)) break;
        }
      } else paper.style.removeProperty("--compact-scale");
      const heights = Array.from(table.tBodies[0].rows, row => row.getBoundingClientRect().height);
      const totalsHeight = (table.tFoot?.getBoundingClientRect().height || 0) + (paper.querySelector(".document-terms")?.getBoundingClientRect().height || 0);
      try {
        const pages = paginateRows(heights, capacity, totalsHeight);
        if (props.pageMode === "single" && (pages.length !== 1 || Array.from(table.querySelectorAll("th,td")).some(cell => cell.scrollWidth > cell.clientWidth + 2)))
          throw new Error("These items cannot fit legibly on one A4 page. Choose Split across pages or shorten the item text.");
        setLayout({ source: props, pages, widths, scale, error: "" });
      } catch (error) {
        setLayout({ source: props, pages: [], widths, scale, error: error instanceof Error ? error.message : "This layout does not fit the page." });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [props, fontRevision]);

  const ready = layout?.source === props;
  return <div className="paginated-document" data-document-kind={props.kind} data-pagination-ready={ready ? "true" : "false"}>
    <article ref={measurement} className={`paper paper-measurement ${props.pageMode === "single" ? "paper-compact" : ""}`} aria-hidden="true">
      <PageContent {...props} rows={props.lines.map((_, index) => index)} finalPage />
    </article>
    {layout?.error && <p className="pagination-error no-print" role="alert">{layout.error}</p>}
    {layout?.pages.map((rows, index) => <article className={`paper ${layout.source.pageMode === "single" ? "paper-compact" : ""}`} style={layout.source.pageMode === "single" ? { "--compact-scale": layout.scale } as React.CSSProperties : undefined} data-export-page data-page-kind={props.kind} key={index}>
      <Image src="/main-pad.jpg" alt="" fill priority className="pad-bg" />
      <PageContent {...layout.source} rows={rows} widths={layout.widths} finalPage={index === layout.pages.length - 1} />
      {layout.pages.length > 1 && <span className="page-number">{props.kind === "bill" ? "Bill" : "Challan"} · Page {index + 1} of {layout.pages.length}</span>}
    </article>)}
  </div>;
}

function visibleColumns(p: DocumentProps) {
  return p.kind === "bill" ? p.template.columns : p.template.columns.filter(column => column !== "price" && column !== "total");
}

function PageContent(p: DocumentProps & { rows: number[]; widths?: number[]; finalPage: boolean }) {
  const isBill = p.kind === "bill";
  const columns = visibleColumns(p);
  return <div className="paper-content">
    <div className="document-body">
      <div className={`doc-top ${p.template.showDocumentMeta === false ? "doc-top-no-meta" : ""}`}>
        <div className="address-block"><b>{isBill ? "BILL TO," : "Delivery Address:"}</b><strong>{p.company}</strong><span>{p.address}</span><span>{p.contact}</span>{p.po && <span>PO: {p.po}</span>}</div>
        {p.template.showDocumentMeta !== false && <div className="doc-meta"><u>{isBill ? "BILL" : "DELIVERY CHALLAN"}</u><div><span>{isBill ? "BILL NO" : "CHALLAN"}</span><span>DATE</span><b>{p.number}</b><b>{p.date.split("-").reverse().join("/")}</b></div></div>}
      </div>
      <table style={p.widths ? { tableLayout: "fixed" } : undefined}>
        <colgroup>{["serial", ...columns].map((key, index) => <col key={key} style={p.widths ? { width: `${p.widths[index]}%` } : undefined} />)}</colgroup>
        <thead><tr style={p.template.headerHeight ? { height: p.template.headerHeight } : undefined}><th>SL.<br />NO</th>{columns.map(column => <th key={column}>{labels[column]}</th>)}</tr></thead>
        <tbody>{p.rows.map(index => {
          const item = p.lines[index];
          return <tr key={item.rowId} data-line-index={index} style={p.template.rowHeight ? { height: p.template.rowHeight } : undefined}>
            <td>{index + 1}</td>{columns.map(column => <td key={column} className={["qty", "price", "total"].includes(column) ? "number" : ""}>{column === "qty" ? item.qty : column === "price" ? money(item.price) : column === "total" ? money(item.qty * item.price) : String(item[column])}</td>)}
          </tr>;
        })}</tbody>
        {isBill && p.finalPage && p.template.showTotals !== false && columns.includes("total") && <tfoot>{p.template.vatRate > 0 && <><tr><td colSpan={columns.length}>SUB TOTAL</td><td>{money(p.subtotal)}</td></tr><tr><td colSpan={columns.length}>VAT {p.template.vatRate}%</td><td>{money(p.vat)}</td></tr></>}<tr className="grand-total-row" style={p.template.totalRowHeight ? { height: p.template.totalRowHeight } : undefined}><td colSpan={columns.length}>{p.template.totalLabel?.trim() || "TOTAL"}</td><td>{money(p.total)}</td></tr></tfoot>}
      </table>
      {p.finalPage && p.template.showTerms && p.template.terms?.trim() && <section className="document-terms"><h3>CONDITION:</h3><TermsContent value={p.template.terms} /></section>}
    </div>
    <div className="signatures"><span>Receiver’s Signature</span><span>Authorized Signature</span></div>
  </div>;
}
