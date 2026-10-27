"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { AppBrand } from "@/components/app-brand";

type Mode = "login" | "forgot" | "reset" | "change";
export function AuthForm({ mode, csrfToken, email: accountEmail }: { mode: Mode; csrfToken?: string; email?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const resetFragment = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const title = { login: "Sign in", forgot: "Forgot password?", reset: "Reset password", change: "Account security" }[mode];

  useEffect(() => {
    if (mode !== "reset") return;
    if (resetFragment.current === null) resetFragment.current = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    const value = resetFragment.current;
    window.history.replaceState(null, "", window.location.pathname);
    const timer = window.setTimeout(() => { setResetToken(value); if (!value) setError("Open the reset link from your email, or request a new link."); }, 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(""); setMessage("");
    if ((mode === "reset" || mode === "change") && password !== confirmation) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        await apiRequest("/api/auth/login", { method: "POST", body: { email, password }, redirectOn401: false });
        window.location.replace("/");
      } else {
        const endpoint = mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : "change-password";
        const body = mode === "forgot" ? { email } : mode === "reset" ? { token: resetToken, password } : { currentPassword, password };
        const result = await apiRequest(`/api/auth/${endpoint}`, { method: "POST", body, csrfToken, redirectOn401: mode === "change" });
        setMessage(result.message || "Request completed.");
        if (mode !== "forgot") { setFinished(true); setPassword(""); setConfirmation(""); setCurrentPassword(""); setResetToken(""); }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><AppBrand compact/><LockKeyhole size={21}/></div>
    <h1>{title}</h1>
    <p>{mode === "login" ? "Sign in to access your invoices, products and templates." : mode === "forgot" ? "Enter your account email to request a password-reset link." : mode === "reset" ? "Choose a new password with at least 12 characters." : `Signed in as ${accountEmail}. Changing your password signs out all sessions.`}</p>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {message && <div className="auth-success" role="status">{message}</div>}
    {!finished && <form onSubmit={submit}>
      {(mode === "login" || mode === "forgot") && <label htmlFor="auth-email">Email<input id="auth-email" name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>}
      {mode === "change" && <label htmlFor="auth-current-password">Current password<input id="auth-current-password" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>}
      {mode !== "forgot" && <label htmlFor="auth-password">{mode === "login" ? "Password" : "New password"}<input id="auth-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>}
      {(mode === "reset" || mode === "change") && <label htmlFor="auth-confirm">Confirm new password<input id="auth-confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>}
      <button className="auth-submit" disabled={busy || (mode === "reset" && !resetToken)}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Change password"}</button>
    </form>}
    <div className="auth-links">{mode === "login" ? <a href="/forgot-password">Forgot password?</a> : <a href={mode === "change" && !finished ? "/" : "/login"}>{mode === "change" && !finished ? "Back to invoices" : "Back to sign in"}</a>}{mode === "reset" && !finished && <a href="/forgot-password">Request a new link</a>}</div>
  </section></main>;
}

