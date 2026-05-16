export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.message || body.error || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
