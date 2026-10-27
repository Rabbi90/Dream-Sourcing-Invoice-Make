import { z } from "zod";
import { MAX_PDF_BYTES } from "@/lib/document-history";
import { documentSnapshotSchema } from "@/lib/document-schema";
import { getHistoryPage, saveHistory } from "@/lib/server/history";
import { authenticated, failed, json, readBody, RequestError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const saveSchema = z.object({
  snapshot: documentSnapshotSchema,
  pdfBase64: z.string().min(1).max(Math.ceil(MAX_PDF_BYTES / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  pageCount: z.number().int().min(1).max(1000), sourceId: z.string().uuid().optional(),
}).strict();
export async function GET(request: Request) {
  try {
    await authenticated();
    return json(await getHistoryPage(Number(new URL(request.url).searchParams.get("page") || 1)));
  } catch (error) { return failed(error); }
}
export async function POST(request: Request) {
  try {
    await authenticated(request);
    const parsed = saveSchema.safeParse(await readBody(request, 5 * 1024 * 1024));
    if (!parsed.success) throw new RequestError(400, "Check the document details. History accepts PDFs up to 3 MB and up to 500 items.");
    const { snapshot, pdfBase64, pageCount, sourceId } = parsed.data;
    const pdf = Buffer.from(pdfBase64, "base64");
    if (pdf.length > MAX_PDF_BYTES || pdf.toString("base64") !== pdfBase64 || !pdf.subarray(0, 5).equals(Buffer.from("%PDF-")) || !pdf.subarray(-1024).includes(Buffer.from("%%EOF")))
      throw new RequestError(400, "A valid PDF of up to 3 MB is required.");
    return json(await saveHistory(snapshot, pdfBase64, pageCount, sourceId), 201);
  } catch (error) { return failed(error); }
}
