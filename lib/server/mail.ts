import "server-only";
import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appOrigin, localStorageEnabled } from "./config";
import { RESET_MINUTES } from "./auth";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM) ||
    Boolean(localStorageEnabled() && process.env.AUTH_TEST_OUTBOX);
}
export async function sendResetMail(email: string, resetToken: string) {
  const link = `${appOrigin()}/reset-password#token=${encodeURIComponent(resetToken)}`;
  const message = {
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Reset your Dream Sourcing password",
    text: `A password reset was requested for your Dream Sourcing account.\n\nChoose a new password here:\n${link}\n\nThis link expires in ${RESET_MINUTES} minutes and can be used only once. If you did not request this, ignore this message.`,
  };
  if (localStorageEnabled() && process.env.AUTH_TEST_OUTBOX) {
    await mkdir(process.env.AUTH_TEST_OUTBOX, { recursive: true, mode: 0o700 });
    await writeFile(path.join(process.env.AUTH_TEST_OUTBOX, `${randomUUID()}.json`), JSON.stringify(message), { mode: 0o600 });
    return;
  }
  if (!mailConfigured()) throw new Error("Mail sender is not configured.");
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  await transport.sendMail(message);
}
