import { after } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { account, allowAttempt, digest, endSession, equal, hashPassword, RESET_MINUTES, SESSION_SECONDS, startSession, token, validToken, verifyPassword } from "@/lib/server/auth";
import { secureCookies, sessionCookieName } from "@/lib/server/config";
import { authenticated, failed, json, readBody, RequestError } from "@/lib/server/http";
import { mailConfigured, sendResetMail } from "@/lib/server/mail";
import { writeRecord } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
const emailField = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const passwordField = z.string().min(12).max(128);
const message = "If this email is registered, password-reset instructions will be sent. Check your inbox and spam folder.";

export async function GET(_request: Request, context: Context) {
  try {
    if ((await context.params).action !== "session") return json({ error: "Not found." }, 404);
    const session = await authenticated();
    return json({ email: session.email, csrfToken: session.csrfToken, expiresAt: session.expiresAt });
  } catch (error) { return failed(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const { action } = await context.params;
    const body = await readBody(request);
    if (action === "login") {
      if (!await allowAttempt("login", 15, 15 * 60 * 1000)) throw new RequestError(429, "Too many sign-in attempts. Please try again in 15 minutes.");
      const parsed = z.object({ email: emailField, password: z.string().min(1).max(128) }).strict().safeParse(body);
      if (!parsed.success) throw new RequestError(400, "Enter a valid email and password.");
      const user = await account();
      const correctPassword = await verifyPassword(parsed.data.password, user.value.passwordHash);
      if (!correctPassword || !equal(parsed.data.email, user.value.email)) throw new RequestError(401, "Email or password is incorrect.");
      const created = await startSession(user.value);
      const response = json({ ok: true });
      response.cookies.set(sessionCookieName(), created.value, { httpOnly: true, secure: secureCookies(), sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
      return response;
    }
    if (action === "logout") {
      await authenticated(request);
      await endSession();
      const response = json({ ok: true });
      response.cookies.set(sessionCookieName(), "", { httpOnly: true, secure: secureCookies(), sameSite: "strict", path: "/", maxAge: 0 });
      return response;
    }
    if (action === "forgot-password") {
      const parsed = z.object({ email: emailField }).strict().safeParse(body);
      if (!parsed.success) throw new RequestError(400, "Enter a valid email address.");
      if (!mailConfigured()) throw new RequestError(503, "Password recovery is not configured yet. Contact the site administrator.");
      if (!await allowAttempt("forgot-password", 3, 60 * 60 * 1000)) return json({ message });
      // SMTP runs after the response, so response content and timing do not
      // reveal whether the supplied email belongs to the private account.
      after(async () => {
        try {
          for (let attempt = 0; attempt < 5; attempt++) {
            const user = await account();
            if (!equal(parsed.data.email, user.value.email)) return;
            const resetToken = token();
            const updated = { ...user.value, reset: { digest: digest(resetToken), expiresAt: Date.now() + RESET_MINUTES * 60 * 1000 } };
            if (!await writeRecord("account", updated, user.etag)) continue;
            await sendResetMail(user.value.email, resetToken);
            return;
          }
        } catch { console.error("Password-reset delivery failed. Check the configured mail service."); }
      });
      return json({ message });
    }
    if (action === "reset-password") {
      if (!await allowAttempt("reset-password", 20, 15 * 60 * 1000)) throw new RequestError(429, "Too many attempts. Please try again later.");
      const parsed = z.object({ token: z.string().refine(validToken), password: passwordField }).strict().safeParse(body);
      if (!parsed.success) throw new RequestError(400, "Use a valid reset link and a password of 12–128 characters.");
      const user = await account();
      if (!user.value.reset || user.value.reset.expiresAt <= Date.now() || !equal(digest(parsed.data.token), user.value.reset.digest)) throw new RequestError(400, "This reset link is invalid or expired. Request a new one.");
      const passwordHash = await hashPassword(parsed.data.password);
      if (user.value.reset.expiresAt <= Date.now() || !await writeRecord("account", { ...user.value, passwordHash, reset: null, version: randomUUID() }, user.etag)) throw new RequestError(400, "This reset link is invalid or expired. Request a new one.");
      return json({ message: "Password changed. Sign in with your new password." });
    }
    if (action === "change-password") {
      const session = await authenticated(request);
      if (!await allowAttempt("change-password", 5, 15 * 60 * 1000)) throw new RequestError(429, "Too many attempts. Please try again later.");
      const parsed = z.object({ currentPassword: z.string().min(1).max(128), password: passwordField }).strict().safeParse(body);
      if (!parsed.success) throw new RequestError(400, "Enter your current password and a new password of 12–128 characters.");
      const user = await account();
      if (user.value.version !== session.accountVersion) throw new RequestError(401, "Please sign in again.");
      if (!await verifyPassword(parsed.data.currentPassword, user.value.passwordHash)) throw new RequestError(400, "Your current password is incorrect.");
      const passwordHash = await hashPassword(parsed.data.password);
      if (!await writeRecord("account", { ...user.value, passwordHash, reset: null, version: randomUUID() }, user.etag)) throw new RequestError(409, "Account changed. Please sign in and try again.");
      const response = json({ message: "Password changed. All sessions have been signed out." });
      response.cookies.set(sessionCookieName(), "", { httpOnly: true, secure: secureCookies(), sameSite: "strict", path: "/", maxAge: 0 });
      return response;
    }
    return json({ error: "Not found." }, 404);
  } catch (error) { return failed(error); }
}

