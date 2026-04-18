import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated. Log in again." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prop_id, selection } = body;

    if (!prop_id || selection === undefined || selection === null) {
      return NextResponse.json(
        { error: "Missing prop_id or selection" },
        { status: 400 }
      );
    }

    const { data: prop, error: propError } = await supabase
      .from("props")
      .select("id, status, locks_at")
      .eq("id", prop_id)
      .single();

    if (propError || !prop) {
      return NextResponse.json({ error: "Prop not found" }, { status: 404 });
    }

    if (prop.status !== "open") {
      return NextResponse.json({ error: "Prop is not open" }, { status: 403 });
    }

    if (prop.locks_at && new Date(prop.locks_at) <= new Date()) {
      return NextResponse.json({ error: "Prop is locked" }, { status: 403 });
    }

    const { error: upsertError } = await supabase
      .from("prop_picks")
      .upsert(
        {
          user_id: user.id,
          prop_id,
          selection,
        },
        { onConflict: "user_id,prop_id" }
      );

    if (upsertError) {
      console.error("[/api/picks/prop] upsert error:", upsertError);
      return NextResponse.json(
        { error: upsertError.message ?? "Database error saving pick" },
        { status: 500 }
      );
    }

    await supabase.from("activity_events").insert({
      event_type: "pick_placed",
      actor_id: user.id,
      payload: { prop_id, selection, pick_kind: "prop" },
      importance: 1,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/picks/prop] fatal:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
