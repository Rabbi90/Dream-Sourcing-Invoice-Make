import "server-only";
import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { localStorageEnabled } from "./config";

type Entry<T> = { value: T; etag: string };
const remote = () => getStore({ name: "dream-sourcing-private-v1", consistency: "strong" });
const localPath = (key: string) => path.join(process.env.AUTH_LOCAL_DIR || path.join(process.cwd(), ".auth-data"), `${createHash("sha256").update(key).digest("hex")}.json`);

export async function readRecord<T>(key: string): Promise<Entry<T> | null> {
  if (!localStorageEnabled()) {
    const result = await remote().getWithMetadata(key, { type: "json", consistency: "strong" });
    if (result && !result.etag) throw new Error("The private store did not return a revision.");
    return result ? { value: result.data as T, etag: result.etag! } : null;
  }
  try { return JSON.parse(await readFile(localPath(key), "utf8")) as Entry<T>; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

// Every update uses a compare-and-swap. Password reset and concurrent saves
// must never silently overwrite a newer account or catalog revision.
export async function writeRecord<T>(key: string, value: T, expected: string | null): Promise<boolean> {
  if (!localStorageEnabled()) {
    const result = await remote().setJSON(key, value, expected === null ? { onlyIfNew: true } : { onlyIfMatch: expected });
    return result.modified;
  }
  const filename = localPath(key);
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const lock = `${filename}.lock`;
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await mkdir(lock); acquired = true; break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; await new Promise(resolve => setTimeout(resolve, 10)); }
  }
  if (!acquired) throw new Error("Local store is busy.");
  try {
    const current = await readRecord<T>(key);
    if ((current?.etag ?? null) !== expected) return false;
    const temporary = `${filename}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify({ value, etag: randomUUID() }), { mode: 0o600 });
    await rename(temporary, filename);
    return true;
  } finally { await rm(lock, { recursive: true, force: true }); }
}

export async function deleteRecord(key: string) {
  if (!localStorageEnabled()) await remote().delete(key);
  else await rm(localPath(key), { force: true });
}
