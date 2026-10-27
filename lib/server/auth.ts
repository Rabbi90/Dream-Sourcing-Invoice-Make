import "server-only";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initialEmail, initialPasswordHash } from "./initial-account";
import { sessionCookieName } from "./config";
import { deleteRecord, readRecord, writeRecord } from "./store";

export type Account = { email: string; passwordHash: string; version: string; reset: { digest: string; expiresAt: number } | null };
export type Session = { email: string; accountVersion: string; expiresAt: number; csrfToken: string };
export const SESSION_SECONDS = 8 * 60 * 60;
export const RESET_MINUTES = 15;
export const token = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const equal = (a: string, b: string) => timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
export const validToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

async function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  return ["scrypt", "32768", "8", "3", salt, (await derive(password, salt)).toString("base64url")].join("$");
}
export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts.slice(0, 4).join("$") !== "scrypt$32768$8$3" || !/^[A-Za-z0-9_-]{22}$/.test(parts[4])) return false;
  const expected = Buffer.from(parts[5], "base64url");
  const actual = await derive(password, parts[4]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function account() {
  let entry = await readRecord<Account>("account");
  if (!entry) {
    if (!initialPasswordHash) throw new Error("Set AUTH_INITIAL_PASSWORD_HASH before initializing a new private account.");
    await writeRecord<Account>("account", {
      email: initialEmail.toLowerCase(), passwordHash: initialPasswordHash,
      version: randomUUID(), reset: null,
    }, null);
    entry = await readRecord<Account>("account");
  }
  if (!entry) throw new Error("Account initialization failed.");
  return entry;
}

export async function startSession(user: Account) {
  const value = token();
  const session: Session = { email: user.email, accountVersion: user.version, expiresAt: Date.now() + SESSION_SECONDS * 1000, csrfToken: token() };
  if (!await writeRecord(`sessions/${digest(value)}`, session, null)) throw new Error("Session initialization failed.");
  return { value, session };
}

export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(sessionCookieName())?.value;
  if (!value || !validToken(value)) return null;
  const entry = await readRecord<Session>(`sessions/${digest(value)}`);
  if (!entry || entry.value.expiresAt <= Date.now()) return null;
  const user = await account();
  if (entry.value.accountVersion !== user.value.version || entry.value.email !== user.value.email) return null;
  return entry.value;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function endSession() {
  const value = (await cookies()).get(sessionCookieName())?.value;
  if (value && validToken(value)) await deleteRecord(`sessions/${digest(value)}`);
}

// Shared, persistent limits apply even when an attacker varies submitted email
// addresses or spoofs forwarding headers. Serverless instances share counters.
export async function allowAttempt(action: string, limit: number, windowMs: number) {
  const key = `limits/${action}`;
  for (let attempt = 0; attempt < 12; attempt++) {
    const entry = await readRecord<{ count: number; until: number }>(key);
    const state = entry && entry.value.until > Date.now() ? entry.value : { count: 0, until: Date.now() + windowMs };
    if (state.count >= limit) return false;
    if (await writeRecord(key, { ...state, count: state.count + 1 }, entry?.etag ?? null)) return true;
  }
  return false;
}

