export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let parsed: any = body;
    try {
      parsed = JSON.parse(body);
    } catch {}
    const msg =
      parsed?.message ||
      (typeof parsed === "string" && parsed) ||
      `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as any;
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiPut<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}
