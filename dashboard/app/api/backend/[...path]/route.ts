import { NextRequest, NextResponse } from "next/server";
import {
  hasTrustedOrigin,
  refreshSupabaseSession,
  setSessionCookies,
} from "@/lib/server/supabase-auth";

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(
  request: NextRequest,
  context: RouteContext,
  method: string,
) {
  if (method !== "GET" && method !== "HEAD" && !hasTrustedOrigin(request)) {
    return NextResponse.json({ detail: "Request origin is not allowed." }, { status: 403 });
  }
  const { path } = await context.params;
  if (
    path[0] !== "api" ||
    path.some((part) => part === "." || part === ".." || !/^[a-zA-Z0-9._~-]+$/.test(part))
  ) {
    return NextResponse.json({ detail: "Invalid API path." }, { status: 400 });
  }
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ detail: "BACKEND_API_URL is not configured." }, { status: 503 });
  }
  let accessToken = request.cookies.get("dc_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ detail: "Authentication required." }, { status: 401 });
  }
  const endpoint = new URL(
    `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
    backendUrl,
  );
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 1_048_576) {
    return NextResponse.json({ detail: "Request body exceeds the 1 MB limit." }, { status: 413 });
  }
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  if (body && body.byteLength > 1_048_576) {
    return NextResponse.json({ detail: "Request body exceeds the 1 MB limit." }, { status: 413 });
  }
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const send = () =>
    fetch(endpoint, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  try {
    let backendResponse = await send();
    let refreshed = null;
    const refreshToken = request.cookies.get("dc_refresh_token")?.value;
    if (backendResponse.status === 401 && refreshToken) {
      refreshed = await refreshSupabaseSession(refreshToken);
      if (refreshed) {
        accessToken = refreshed.access_token;
        headers.set("Authorization", `Bearer ${accessToken}`);
        backendResponse = await send();
      }
    }
    const response = new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      headers: {
        "Content-Type": backendResponse.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
    if (refreshed) setSessionCookies(response, refreshed);
    return response;
  } catch {
    return NextResponse.json({ detail: "Backend service is unavailable." }, { status: 503 });
  }
}

export const GET = (request: NextRequest, context: RouteContext) =>
  forward(request, context, "GET");
export const POST = (request: NextRequest, context: RouteContext) =>
  forward(request, context, "POST");
export const PUT = (request: NextRequest, context: RouteContext) =>
  forward(request, context, "PUT");
export const PATCH = (request: NextRequest, context: RouteContext) =>
  forward(request, context, "PATCH");
export const DELETE = (request: NextRequest, context: RouteContext) =>
  forward(request, context, "DELETE");
