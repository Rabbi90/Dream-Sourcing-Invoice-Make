import { getHistoryEntry } from "@/lib/server/history";
import { authenticated, failed } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authenticated();
    const entry = await getHistoryEntry((await params).id);
    return new Response(Buffer.from(entry.pdfBase64, "base64"), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${entry.filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return failed(error); }
}
