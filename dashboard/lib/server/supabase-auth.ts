import { NextResponse } from "next/server";

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: { name?: string };
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user: SupabaseUser;
};

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be configured.");
  }
  return { url: url.replace(/\/+$/, ""), anonKey };
}

export function getDashboardUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be configured.");
  }
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS outside localhost.");
  }
  return parsed.origin;
}

export function hasTrustedOrigin(request: Request) {
  try {
    return request.headers.get("origin") === getDashboardUrl();
  } catch {
    return false;
  }
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, anonKey } = getSupabaseConfig();
  return fetch(`${url}/auth/v1/${path}`, {
    ...init,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(10_000),
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export function setSessionCookies(response: NextResponse, session: SupabaseSession) {
  const secure = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
  response.cookies.set("dc_access_token", session.access_token, {
    ...cookieOptions,
    maxAge: session.expires_in ?? 3600,
  });
  response.cookies.set("dc_refresh_token", session.refresh_token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete("dc_access_token");
  response.cookies.delete("dc_refresh_token");
}

export async function readSupabaseError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body === "object" && body !== null) {
    if ("msg" in body && typeof body.msg === "string") return body.msg;
    if ("message" in body && typeof body.message === "string") return body.message;
    if ("error_description" in body && typeof body.error_description === "string") {
      return body.error_description;
    }
  }
  return `Authentication service returned ${response.status}.`;
}

export async function refreshSupabaseSession(refreshToken: string) {
  const response = await supabaseRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  return (await response.json()) as SupabaseSession;
}
