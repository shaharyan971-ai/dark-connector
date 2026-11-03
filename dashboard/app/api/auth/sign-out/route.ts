import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookies,
  hasTrustedOrigin,
  readSupabaseError,
  supabaseRequest,
} from "@/lib/server/supabase-auth";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  const accessToken = request.cookies.get("dc_access_token")?.value;
  let warning: string | undefined;
  if (accessToken) {
    try {
      const result = await supabaseRequest("logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!result.ok) warning = await readSupabaseError(result);
    } catch {
      warning = "Your local session was cleared, but the authentication service could not revoke it.";
    }
  }
  const response = NextResponse.json({ ok: true, warning });
  clearSessionCookies(response);
  return response;
}
