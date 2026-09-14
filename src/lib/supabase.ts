const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type AuthSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user: AuthUser;
};

const STORAGE_KEY = "rydah-local-session";

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase environment variables are not configured.");
  }
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

export function clearSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function apiHeaders(token?: string, extras?: Record<string, string>) {
  assertConfigured();
  return {
    apikey: SUPABASE_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extras,
  };
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string; error_description?: string; msg?: string };
    return data.message || data.error_description || data.msg || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export async function restGet<T>(path: string, token?: string): Promise<T> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "GET",
    headers: apiHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export async function restInsert<T>(table: string, payload: unknown, token?: string): Promise<T> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: apiHeaders(token, {
      "Content-Type": "application/json",
      Prefer: token ? "return=representation" : "return=minimal",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(await readError(response));
  if (!token) return [] as T;
  return (await response.json()) as T;
}

export async function restInsertMinimal(table: string, payload: unknown, token?: string): Promise<void> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: apiHeaders(token, {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(await readError(response));
}

export async function restDelete(table: string, query: string, token: string): Promise<void> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: apiHeaders(token),
  });

  if (!response.ok) throw new Error(await readError(response));
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: apiHeaders(undefined, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AuthSession;
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  role: "customer" | "provider";
}): Promise<Partial<AuthSession> & { user?: AuthUser }> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: apiHeaders(undefined, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: {
        full_name: input.fullName,
        role: input.role,
      },
    }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as Partial<AuthSession> & { user?: AuthUser };
}
