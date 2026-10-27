import "server-only";
import { NextResponse } from "next/server";
import { appOrigin } from "./config";
import { equal, getSession, type Session } from "./auth";

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(data: unknown, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Netlify-CDN-Cache-Control", "no-store");
  return response;
}
export function failed(error: unknown) {
  if (error instanceof RequestError) return json({ error: error.message }, error.status);
  console.error("A private application request failed. Check the server and mail configuration.");
  return json({ error: "The service is temporarily unavailable. Please try again or contact the site administrator." }, 503);
}
export async function readBody(request: Request, maxBytes = 4096): Promise<unknown> {
  if (request.headers.get("origin") !== appOrigin() || request.headers.get("x-requested-with") !== "DreamSourcing") throw new RequestError(403, "Request not allowed.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new RequestError(415, "JSON is required.");
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new RequestError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.length;
    if (size > maxBytes) { await reader.cancel(); throw new RequestError(413, "Request is too large."); }
    chunks.push(result.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new RequestError(400, "Invalid request."); }
}
export async function authenticated(request?: Request): Promise<Session> {
  const session = await getSession();
  if (!session) throw new RequestError(401, "Your session has expired. Please sign in again.");
  if (request && !equal(request.headers.get("x-csrf-token") || "", session.csrfToken)) throw new RequestError(403, "Request not allowed.");
  return session;
}

