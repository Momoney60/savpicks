import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const t0 = Date.now();
  let body: any = null;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const series_id = body?.series_id;
  const picked_team_id = body?.picked_team_id;

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn(`[picks/bracket] event=auth_fail series=${series_id ?? "?"} team=${picked_team_id ?? "?"} err=${authError?.message ?? "no_user"}`);
      return NextResponse.json(
        { error: "Not authenticated. Log in again." },
        { status: 401 }
      );
    }

    const ctx = `user=${user.id} series=${series_id ?? "?"} team=${picked_team_id ?? "?"}`;
    console.log(`[picks/bracket] event=received ${ctx}`);

    if (!series_id || !picked_team_id) {
      console.warn(`[picks/bracket] event=missing_fields ${ctx}`);
      return NextResponse.json(
        { error: "Missing series_id or picked_team_id" },
        { status: 400 }
      );
    }

    const { data: series, error: seriesError } = await supabase
      .from("series")
      .select("id, picks_lock_at, status, team_a_id, team_b_id")
      .eq("id", series_id)
      .single();

    if (seriesError || !series) {
      console.warn(`[picks/bracket] event=series_not_found ${ctx} err=${seriesError?.message}`);
      return NextResponse.json(
        { error: "Series not found" },
        { status: 404 }
      );
    }

    if (series.picks_lock_at && new Date(series.picks_lock_at) <= new Date()) {
      console.warn(`[picks/bracket] event=locked ${ctx} lock=${series.picks_lock_at}`);
      return NextResponse.json(
        { error: "Picks are locked for this series" },
        { status: 403 }
      );
    }

    if (picked_team_id !== series.team_a_id && picked_team_id !== series.team_b_id) {
      console.warn(`[picks/bracket] event=team_mismatch ${ctx} a=${series.team_a_id} b=${series.team_b_id}`);
      return NextResponse.json(
        { error: "Team not in this series" },
        { status: 400 }
      );
    }

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
      console.error(`[picks/bracket] event=db_error ${ctx} err=${upsertError.message}`);
      return NextResponse.json(
        { error: upsertError.message ?? "Database error saving pick" },
        { status: 500 }
      );
    }

    await supabase.from("activity_events").insert({
      event_type: "pick_placed",
      actor_id: user.id,
      payload: { series_id, picked_team_id, pick_kind: "bracket" },
      importance: 1,
    });

    console.log(`[picks/bracket] event=saved ${ctx} ms=${Date.now() - t0}`);
    return NextResponse.json({ ok: true, user_id: user.id, series_id, picked_team_id });
  } catch (e: any) {
    console.error(`[picks/bracket] event=fatal series=${series_id ?? "?"} team=${picked_team_id ?? "?"} err=${e?.message ?? String(e)}`);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}