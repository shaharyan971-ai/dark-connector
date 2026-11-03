import { NextRequest, NextResponse } from "next/server";
import {
  getDashboardUrl,
  readSupabaseError,
  setSessionCookies,
  supabaseRequest,
  type SupabaseSession,
} from "@/lib/server/supabase-auth";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const allowedTypes = new Set(["signup", "email", "recovery", "email_change", "magiclink"]);
  if (!tokenHash || !type || !allowedTypes.has(type)) {
    return NextResponse.redirect(new URL("/?authError=invalid-link", getDashboardUrl()));
  }

  try {
    const response = await supabaseRequest("verify", {
      method: "POST",
      body: JSON.stringify({ token_hash: tokenHash, type }),
    });
    if (!response.ok) {
      const message = await readSupabaseError(response);
      const redirect = NextResponse.redirect(new URL("/?authError=confirmation-failed", getDashboardUrl()));
      redirect.headers.set("X-Auth-Error-Detail", message);
      return redirect;
    }
    const session = (await response.json()) as SupabaseSession;
    const redirect = NextResponse.redirect(
      new URL(type === "recovery" ? "/reset-password" : "/profile", getDashboardUrl()),
    );
    setSessionCookies(redirect, session);
    return redirect;
  } catch {
    return NextResponse.redirect(new URL("/?authError=service-unavailable", getDashboardUrl()));
  }
}
