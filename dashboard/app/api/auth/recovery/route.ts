import { NextRequest, NextResponse } from "next/server";
import {
  getDashboardUrl,
  hasTrustedOrigin,
  readSupabaseError,
  supabaseRequest,
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
    typeof body.email !== "string" ||
    body.email.trim().length < 3 ||
    body.email.trim().length > 255
  ) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  try {
    const redirectTo = new URL("/auth/callback", getDashboardUrl()).toString();
    const response = await supabaseRequest(
      `recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      { method: "POST", body: JSON.stringify({ email: body.email.trim() }) },
    );
    if (!response.ok) {
      return NextResponse.json({ error: await readSupabaseError(response) }, { status: response.status });
    }
    return NextResponse.json({ message: "If the address is registered, a recovery link will be sent." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not contact authentication service." },
      { status: 503 },
    );
  }
}
