import { randomUUID } from "node:crypto";
import { catalogSchema } from "@/lib/catalog-schema";
import { getCatalog } from "@/lib/server/catalog";
import { authenticated, failed, json, readBody, RequestError } from "@/lib/server/http";
import { writeRecord } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await authenticated(); return json((await getCatalog()).value); }
  catch (error) { return failed(error); }
}
export async function PUT(request: Request) {
  try {
    await authenticated(request);
    const parsed = catalogSchema.safeParse(await readBody(request, 512 * 1024));
    if (!parsed.success) throw new RequestError(400, "Invalid catalog data. Check product names, prices, template settings and delivery addresses.");
    const current = await getCatalog();
    if (parsed.data.revision !== current.value.revision) throw new RequestError(409, "Data changed in another tab. Reload this page before saving.");
    const updated = { ...parsed.data, revision: randomUUID() };
    if (!await writeRecord("catalog", updated, current.etag)) throw new RequestError(409, "Data changed in another tab. Reload this page before saving.");
    return json(updated);
  } catch (error) { return failed(error); }
}

