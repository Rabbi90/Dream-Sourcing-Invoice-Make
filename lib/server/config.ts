import "server-only";

export function appOrigin(): string {
  // URL is provided to Netlify Functions at runtime. NETLIFY is a build-time
  // flag and may be absent in Functions, so it must not gate this fallback.
  // Trust deployment configuration only, never a request Host/Origin header.
  const value = process.env.APP_URL?.trim() || process.env.URL?.trim() ||
    (process.env.NODE_ENV === "development" || process.env.AUTH_STORAGE === "local" ? "http://localhost:3000" : "");
  if (!value) throw new Error("APP_URL is required.");
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (!loopback && url.protocol !== "https:")) throw new Error("A secure APP_URL is required.");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid APP_URL.");
  return url.origin;
}

export function localStorageEnabled() {
  if (process.env.AUTH_STORAGE !== "local") return false;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(appOrigin()).hostname) || process.env.NETLIFY || process.env.SITE_ID) {
    throw new Error("Local authentication storage is permitted only on a local development server.");
  }
  return true;
}

export const secureCookies = () => appOrigin().startsWith("https:");
export const sessionCookieName = () => secureCookies() ? "__Host-dream-session" : "dream-session-local";
