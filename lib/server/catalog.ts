import "server-only";
import { randomUUID } from "node:crypto";
import { catalogSchema, type Catalog } from "../catalog-schema";
import { readRecord, writeRecord } from "./store";
import { defaultProducts, defaults } from "./catalog-defaults";

export async function getCatalog() {
  let entry = await readRecord<Catalog>("catalog");
  if (!entry) {
    await writeRecord("catalog", { products: defaultProducts, templates: defaults, revision: randomUUID(), legacyImported: false }, null);
    entry = await readRecord<Catalog>("catalog");
  }
  if (!entry) throw new Error("Catalog initialization failed.");
  return { value: catalogSchema.parse(entry.value), etag: entry.etag };
}

