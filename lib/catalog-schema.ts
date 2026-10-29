import { z } from "zod";

const columns = ["name", "code", "brand", "specification", "unit", "qty", "price", "total"] as const;
export const productSchema = z.object({
  id: z.number().int().safe().optional(), name: z.string().trim().min(1).max(200),
  code: z.string().max(200), brand: z.string().max(200), specification: z.string().max(2000),
  unit: z.string().max(50), price: z.number().finite().min(0).max(1e12), defaultQty: z.number().finite().min(0).max(1e12),
}).strict();
export const templateSchema = z.object({
  id: z.number().int().safe().optional(), name: z.string().trim().min(1).max(100),
  columns: z.array(z.enum(columns)).min(1).max(8).refine(value => new Set(value).size === value.length && value.some(column => column !== "price" && column !== "total")),
  vatRate: z.number().finite().min(0).max(100),
  showDocumentMeta: z.boolean().optional(), showTotals: z.boolean().optional(),
  showTerms: z.boolean().optional(), terms: z.string().max(6000).optional(),
  rowHeight: z.number().min(20).max(200).optional(), headerHeight: z.number().min(20).max(200).optional(),
  totalRowHeight: z.number().min(20).max(200).optional(), totalLabel: z.string().trim().min(1).max(40).optional(),
  columnWidths: z.record(z.enum(["serial", ...columns]), z.number().min(2).max(95)).optional(),
}).strict().refine(value => {
  const values = ["serial", ...value.columns].map(key => value.columnWidths?.[key as keyof typeof value.columnWidths]);
  const sum = values.reduce<number>((n, v) => n + (v || 0), 0);
  return values.some(v => v === undefined) ? sum < 100 : Math.abs(sum - 100) <= .01;
}, "Column widths must fit the table.");

export const catalogSchema = z.object({
  products: z.array(productSchema).max(2000), templates: z.array(templateSchema).min(1).max(200),
  revision: z.string().uuid(), legacyImported: z.boolean(),
}).strict();
export type Catalog = z.infer<typeof catalogSchema>;

