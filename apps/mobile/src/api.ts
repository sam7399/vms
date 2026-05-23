import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:4000";

const TOKEN_KEY = "vms_token";
const USER_KEY = "vms_user";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string;
  orgId?: string | null;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<SessionUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setSession(token: string, user: SessionUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || `${res.status} ${res.statusText}`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return text ? (JSON.parse(text) as T) : (undefined as any);
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: SessionUser }>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),
  checkIn: (qrCodeToken: string) =>
    request<{ visitorName?: string }>("/gate/check-in", {
      method: "POST",
      body: { qrCodeToken },
      auth: false,
    }),
  pendingVisits: () => request<any[]>("/visitors/pending"),
  decide: (visitId: string, status: "APPROVED" | "REJECTED") =>
    request<any>(`/visitors/visit/${visitId}/status`, {
      method: "PUT",
      body: { status },
    }),
};
