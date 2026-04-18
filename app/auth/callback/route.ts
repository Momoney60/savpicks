import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app/pulse";

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth=failed`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?auth=failed`);
  }

  // First-login bootstrap: create a profile row if none exists.
  // Uses service client to bypass RLS during initial insert.
  const service = createServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existing) {
    const fallbackTag =
      data.user.email?.split("@")[0]?.slice(0, 20) ?? `user_${data.user.id.slice(0, 6)}`;

    await service.from("profiles").insert({
      id: data.user.id,
      gamertag: fallbackTag,
      is_admin: false,
      is_paid: false,
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
