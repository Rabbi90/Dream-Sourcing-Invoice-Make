import { z } from "zod";
import { productSchema, templateSchema } from "./catalog-schema";

const text = z.string().max(2000);
export const documentSnapshotSchema = z.object({
  billNo: z.string().trim().min(1).max(200),
  challanNo: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid document date."),
  company: z.string().trim().min(1).max(200), address: text, contact: text, po: text,
  docType: z.enum(["bill", "challan", "both"]), pageMode: z.enum(["split", "single"]),
  template: templateSchema,
  lines: z.array(productSchema.extend({
    name: z.string().max(200), rowId: z.string().uuid(), qty: z.number().finite().min(0).max(1e12),
  })).min(1).max(500).refine(rows => new Set(rows.map(row => row.rowId)).size === rows.length),
}).strict();
export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>;
