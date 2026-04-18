import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = request.headers.get("x-ingest-secret");
  if (secret !== process.env.INGEST_SHARED_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { series_id, winner_team_id, wins_a, wins_b } = body;

  if (!series_id || !winner_team_id) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const db = createServiceClient();

  // Mark series complete, set winner
  const { error: updateError } = await db
    .from("series")
    .update({
      winner_id: winner_team_id,
      status: "completed",
      wins_a: wins_a ?? null,
      wins_b: wins_b ?? null,
    })
    .eq("id", series_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // Mark loser eliminated
  const { data: series } = await db
    .from("series")
    .select("team_a_id, team_b_id")
    .eq("id", series_id)
    .single();

  if (series) {
    const loserId = series.team_a_id === winner_team_id ? series.team_b_id : series.team_a_id;
    if (loserId) {
      await db
        .from("teams")
        .update({ is_eliminated: true, eliminated_at: new Date().toISOString() })
        .eq("id", loserId);
    }
  }

  // Trigger bracket resolution — the SQL function walks all picks, applies multipliers,
  // and emits activity events
  const { error: resolveError } = await db.rpc("resolve_series", { p_series_id: series_id });

  if (resolveError) {
    return NextResponse.json({ error: resolveError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
