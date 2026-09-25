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
  expires_at?: number;
  token_type?: string;
  user: AuthUser;
};

const STORAGE_KEY = "rydah-local-session";
let refreshPromise: Promise<AuthSession> | null = null;

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

export async function refreshStoredSession(): Promise<AuthSession> {
  assertConfigured();

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const current = getStoredSession();
    if (!current?.refresh_token) {
      clearSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: apiHeaders(undefined, { "Content-Type": "application/json" }),
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });

    if (!response.ok) {
      clearSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const refreshed = (await response.json()) as AuthSession;
    const nextSession: AuthSession = {
      ...current,
      ...refreshed,
      refresh_token: refreshed.refresh_token || current.refresh_token,
      user: refreshed.user || current.user,
    };

    saveSession(nextSession);
    return nextSession;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function fetchWithOptionalRefresh(
  url: string,
  init: RequestInit,
  token?: string,
  extras?: Record<string, string>,
): Promise<Response> {
  const stored = token ? getStoredSession() : null;
  let activeToken = stored?.access_token || token;

  let response = await fetch(url, {
    ...init,
    headers: apiHeaders(activeToken, extras),
  });

  if (response.status === 401 && activeToken) {
    const refreshed = await refreshStoredSession();
    activeToken = refreshed.access_token;
    response = await fetch(url, {
      ...init,
      headers: apiHeaders(activeToken, extras),
    });
  }

  return response;
}

export async function restGet<T>(path: string, token?: string): Promise<T> {
  assertConfigured();
  const response = await fetchWithOptionalRefresh(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      method: "GET",
      cache: "no-store",
    },
    token,
  );

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export async function restInsert<T>(table: string, payload: unknown, token?: string): Promise<T> {
  assertConfigured();
  const response = await fetchWithOptionalRefresh(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
    {
      "Content-Type": "application/json",
      Prefer: token ? "return=representation" : "return=minimal",
    },
  );

  if (!response.ok) throw new Error(await readError(response));
  if (!token) return [] as T;
  return (await response.json()) as T;
}

export async function restInsertMinimal(table: string, payload: unknown, token?: string): Promise<void> {
  assertConfigured();
  const response = await fetchWithOptionalRefresh(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
    {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  );

  if (!response.ok) throw new Error(await readError(response));
}

export async function restPatch<T>(table: string, query: string, payload: unknown, token: string): Promise<T> {
  assertConfigured();
  const response = await fetchWithOptionalRefresh(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token,
    {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  );

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export async function restDelete(table: string, query: string, token: string): Promise<void> {
  assertConfigured();
  const response = await fetchWithOptionalRefresh(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    { method: "DELETE" },
    token,
  );

  if (!response.ok) throw new Error(await readError(response));
}

export async function restRpc<T>(fn: string, payload: unknown, token: string): Promise<T> {
  assertConfigured();
  const response = await fetchWithOptionalRefresh(
    `${SUPABASE_URL}/rest/v1/rpc/${fn}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
    { "Content-Type": "application/json" },
  );

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

export async function invokeFunction(
  functionName: string,
  payload: unknown,
  token: string,
): Promise<Response> {
  assertConfigured();

  if (!/^[a-z0-9-]+$/.test(functionName)) {
    throw new Error("Invalid backend function name.");
  }

  return fetchWithOptionalRefresh(
    `${SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
    { "Content-Type": "application/json" },
  );
}

export async function storageUpload(bucket: string, path: string, file: File, token: string): Promise<void> {
  assertConfigured();
  const response = await fetchWithOptionalRefresh(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,
    { method: "POST", body: file },
    token,
    { "Content-Type": file.type, "x-upsert": "false" },
  );
  if (!response.ok) throw new Error(await readError(response));
}

export async function storageDelete(bucket: string, paths: string[], token: string): Promise<void> {
  assertConfigured();
  const response = await fetchWithOptionalRefresh(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}`,
    { method: "DELETE", body: JSON.stringify({ prefixes: paths }) },
    token,
    { "Content-Type": "application/json" },
  );
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

export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: apiHeaders(undefined, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email }),
  });

  if (!response.ok) throw new Error(await readError(response));
}

export async function updatePasswordWithRecoveryToken(accessToken: string, password: string): Promise<AuthUser> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: apiHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ password }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AuthUser;
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  role: "customer" | "provider";
  redirectTo?: string;
}): Promise<Partial<AuthSession> & { user?: AuthUser }> {
  assertConfigured();
  const query = input.redirectTo ? `?redirect_to=${encodeURIComponent(input.redirectTo)}` : "";
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup${query}`, {
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
