import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { prop_id, selection } = body;

  if (!prop_id || selection === undefined || selection === null) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("prop_picks")
    .upsert(
      { user_id: user.id, prop_id, selection },
      { onConflict: "user_id,prop_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ pick: data });
}
