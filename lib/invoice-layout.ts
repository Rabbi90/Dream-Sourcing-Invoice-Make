export type ColumnKey = "name" | "code" | "brand" | "specification" | "unit" | "qty" | "price" | "total";
export type WidthKey = ColumnKey | "serial";
export type Product = { id?: number; name: string; code: string; brand: string; specification: string; unit: string; price: number; defaultQty: number };
export type Line = Product & { rowId: string; qty: number };
export type Template = {
  id?: number;
  name: string;
  columns: ColumnKey[];
  vatRate: number;
  columnWidths?: Partial<Record<WidthKey, number>>;
  rowHeight?: number;
  headerHeight?: number;
  totalLabel?: string;
  totalRowHeight?: number;
};

export const labels: Record<ColumnKey, string> = {
  name: "Product Name", code: "Product Code", brand: "Brand", specification: "Net Weight / Specification",
  unit: "Unit", qty: "Qty.", price: "Unit Price", total: "Total Value",
};
export const money = (n: number) => n.toLocaleString("en-BD", { maximumFractionDigits: 2 });

// Measurements come from the actual rendered table, including wrapped text and
// the selected dimensions. Rows remain intact and totals appear only at the end.
export function paginateRows(heights: number[], capacity: number, totalsHeight: number): number[][] {
  if (capacity <= 0 || totalsHeight > capacity) {
    throw new Error("The document heading or totals leave too little space. Shorten the address or reference, or reduce the table dimensions.");
  }
  const pages: number[][] = [[]];
  let used = 0;
  heights.forEach((height, index) => {
    if (height > capacity) {
      throw new Error(`Item ${index + 1} is taller than the available page area. Shorten its text, reduce the row height, or widen the text column.`);
    }
    if (used + height > capacity && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(index);
    used += height;
  });
  if (used + totalsHeight > capacity) {
    const last = pages[pages.length - 1];
    const final: number[] = [];
    // Keep the preceding page full while bringing its last row forward with
    // the totals. An exceptionally tall final row may need a totals-only page.
    if (last.length && totalsHeight + heights[last[last.length - 1]] <= capacity) final.push(last.pop()!);
    pages.push(final);
  }
  return pages;
}

export type ProductSort = "default" | "name-asc" | "name-desc" | "price-asc" | "price-desc";
export function sortProducts(products: Product[], sort: ProductSort): Product[] {
  const sorted = [...products];
  if (sort === "default") return sorted;
  // Imported names can contain leading spaces or invisible copy/paste characters.
  // Compare the visible name, using a fixed locale on both server and browser.
  const nameKey = (name: string) => name.normalize("NFKC").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
  const byName = (a: Product, b: Product) => nameKey(a.name).localeCompare(nameKey(b.name), "en", { numeric: true, sensitivity: "base" });
  return sorted.sort((a, b) => {
    if (sort === "name-asc") return byName(a, b);
    if (sort === "name-desc") return byName(b, a);
    return (sort === "price-asc" ? a.price - b.price : b.price - a.price) || byName(a, b);
  });
}
