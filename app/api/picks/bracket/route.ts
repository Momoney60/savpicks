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
    const { series_id, picked_team_id } = body;

    if (!series_id || !picked_team_id) {
      return NextResponse.json(
        { error: "Missing series_id or picked_team_id" },
        { status: 400 }
      );
    }

    // Validate series is still open
    const { data: series, error: seriesError } = await supabase
      .from("series")
      .select("id, picks_lock_at, status, team_a_id, team_b_id")
      .eq("id", series_id)
      .single();

    if (seriesError || !series) {
      return NextResponse.json(
        { error: "Series not found" },
        { status: 404 }
      );
    }

    if (series.picks_lock_at && new Date(series.picks_lock_at) <= new Date()) {
      return NextResponse.json(
        { error: "Picks are locked for this series" },
        { status: 403 }
      );
    }

    if (picked_team_id !== series.team_a_id && picked_team_id !== series.team_b_id) {
      return NextResponse.json(
        { error: "Team not in this series" },
        { status: 400 }
      );
    }

    // Upsert the pick
    const { error: upsertError } = await supabase
      .from("bracket_picks")
      .upsert(
        {
          user_id: user.id,
          series_id,
          picked_team_id,
        },
        { onConflict: "user_id,series_id" }
      );

    if (upsertError) {
      console.error("[/api/picks/bracket] upsert error:", upsertError);
      return NextResponse.json(
        { error: upsertError.message ?? "Database error saving pick" },
        { status: 500 }
      );
    }

    // Log activity event
    await supabase.from("activity_events").insert({
      event_type: "pick_placed",
      actor_id: user.id,
      payload: { series_id, picked_team_id, pick_kind: "bracket" },
      importance: 1,
    });

    return NextResponse.json({ ok: true, user_id: user.id, series_id, picked_team_id });
  } catch (e: any) {
    console.error("[/api/picks/bracket] fatal:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
