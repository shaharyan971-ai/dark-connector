import { NextRequest, NextResponse } from "next/server";
import {
  refreshSupabaseSession,
  setSessionCookies,
  supabaseRequest,
} from "@/lib/server/supabase-auth";

export async function GET(request: NextRequest) {
  let accessToken = request.cookies.get("dc_access_token")?.value;
  const refreshToken = request.cookies.get("dc_refresh_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    let response = await supabaseRequest("user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    let refreshed = null;
    if (response.status === 401 && refreshToken) {
      refreshed = await refreshSupabaseSession(refreshToken);
      if (refreshed) {
        accessToken = refreshed.access_token;
        response = await supabaseRequest("user", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    }
    if (!response.ok) {
      const expired = NextResponse.json({ user: null });
      expired.cookies.delete("dc_access_token");
      expired.cookies.delete("dc_refresh_token");
      return expired;
    }
    const user = await response.json();
    const result = NextResponse.json({ user });
    if (refreshed) setSessionCookies(result, refreshed);
    return result;
  } catch {
    return NextResponse.json({ error: "Authentication service is unavailable." }, { status: 503 });
  }
}
