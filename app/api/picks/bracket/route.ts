import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { series_id, picked_team_id } = body;

  if (!series_id || !picked_team_id) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  // Upsert by (user_id, series_id)
  const { data, error } = await supabase
    .from("bracket_picks")
    .upsert(
      { user_id: user.id, series_id, picked_team_id },
      { onConflict: "user_id,series_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ pick: data });
}
