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
    !("password" in body) ||
    typeof body.password !== "string" ||
    body.password.length < 10 ||
    body.password.length > 1024
  ) {
    return NextResponse.json(
      { error: "Password must be between 10 and 1024 characters." },
      { status: 400 },
    );
  }
  try {
    const response = await supabaseRequest("user", {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ password: body.password }),
    });
    if (!response.ok) {
      return NextResponse.json({ error: await readSupabaseError(response) }, { status: response.status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Authentication service is unavailable." }, { status: 503 });
  }
}
