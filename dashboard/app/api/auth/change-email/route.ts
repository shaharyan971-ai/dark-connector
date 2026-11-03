import { NextRequest, NextResponse } from "next/server";
import {
  hasTrustedOrigin,
  readSupabaseError,
  supabaseRequest,
} from "@/lib/server/supabase-auth";

export async function PUT(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  const accessToken = request.cookies.get("dc_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    typeof body.email !== "string" ||
    body.email.trim().length < 3 ||
    body.email.trim().length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  ) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const response = await supabaseRequest("user", {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ email: body.email.trim() }),
    });
    if (!response.ok) {
      return NextResponse.json({ error: await readSupabaseError(response) }, { status: response.status });
    }
    const user = await response.json() as { email?: string; new_email?: string };
    return NextResponse.json({
      currentEmail: user.email ?? null,
      confirmationRequired: Boolean(user.new_email && user.new_email !== user.email),
    });
  } catch {
    return NextResponse.json({ error: "Authentication service is unavailable." }, { status: 503 });
  }
}
