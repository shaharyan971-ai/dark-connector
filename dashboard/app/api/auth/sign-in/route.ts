import { NextRequest, NextResponse } from "next/server";
import {
  hasTrustedOrigin,
  readSupabaseError,
  setSessionCookies,
  supabaseRequest,
  type SupabaseSession,
} from "@/lib/server/supabase-auth";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    !("password" in body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 255 ||
    body.password.length > 1024
  ) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  try {
    const authResponse = await supabaseRequest("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: body.email.trim(), password: body.password }),
    });
    if (!authResponse.ok) {
      return NextResponse.json(
        { error: await readSupabaseError(authResponse) },
        { status: authResponse.status },
      );
    }
    const session = (await authResponse.json()) as SupabaseSession;
    const response = NextResponse.json({ user: session.user });
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not contact authentication service." },
      { status: 503 },
    );
  }
}
