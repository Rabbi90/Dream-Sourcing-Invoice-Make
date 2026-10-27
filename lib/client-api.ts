export async function apiRequest<T = { message?: string }>(url: string, options: { method?: string; body?: unknown; csrfToken?: string; redirectOn401?: boolean } = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method || "GET", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Requested-With": "DreamSourcing", ...(options.csrfToken ? { "X-CSRF-Token": options.csrfToken } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && options.redirectOn401 !== false) window.location.replace("/login?expired=1");
    const error = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "The request could not be completed.";
    throw new Error(error);
  }
  if(data === null) throw new Error("The server returned an unexpected response. Please try again.");
  return data as T;
}
