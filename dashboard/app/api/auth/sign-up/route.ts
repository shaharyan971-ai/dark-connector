import { NextRequest, NextResponse } from "next/server";
import {
  getDashboardUrl,
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
    !("name" in body) ||
    !("email" in body) ||
    !("password" in body) ||
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.name.trim().length < 1 ||
    body.name.trim().length > 120 ||
    body.email.trim().length > 255 ||
    body.password.length < 10 ||
    body.password.length > 1024
  ) {
    return NextResponse.json(
      { error: "Provide a name, valid email, and password with at least 10 characters." },
      { status: 400 },
    );
  }

  try {
    const confirmationUrl = new URL("/auth/callback", getDashboardUrl()).toString();
    const authResponse = await supabaseRequest(
      `signup?redirect_to=${encodeURIComponent(confirmationUrl)}`,
      {
        method: "POST",
        body: JSON.stringify({
          email: body.email.trim(),
          password: body.password,
          data: { name: body.name.trim() },
        }),
      },
    );
    if (!authResponse.ok) {
      return NextResponse.json(
        { error: await readSupabaseError(authResponse) },
        { status: authResponse.status },
      );
    }
    const result = (await authResponse.json()) as Partial<SupabaseSession> & {
      user?: SupabaseSession["user"];
    };
    if (!result.access_token || !result.refresh_token || !result.user) {
      return NextResponse.json({
        confirmationRequired: true,
        message: "Check your email to confirm your account, then sign in.",
      });
    }
    const session = result as SupabaseSession;
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
