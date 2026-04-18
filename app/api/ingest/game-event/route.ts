import { createServiceClient } from "@/lib/supabase/service";
import { redis, channels } from "@/lib/upstash/redis";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = request.headers.get("x-ingest-secret");
  if (secret !== process.env.INGEST_SHARED_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    game_id,
    home_team_id,
    away_team_id,
    scheduled_at,
    home_score,
    away_score,
    period,
    clock,
    status,
    goal_events,
    total_pim,
  } = body;

  if (!game_id || !home_team_id || !away_team_id) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const db = createServiceClient();

  // Try to locate matching series for auto-linking
  let seriesId: string | null = null;
  const { data: matchingSeries } = await db
    .from("series")
    .select("id")
    .in("status", ["upcoming", "live"])
    .or(`and(team_a_id.eq.${home_team_id},team_b_id.eq.${away_team_id}),and(team_a_id.eq.${away_team_id},team_b_id.eq.${home_team_id})`)
    .limit(1)
    .maybeSingle();
  if (matchingSeries) seriesId = matchingSeries.id;

  // Upsert the game
  const { data: prev } = await db.from("games").select("*").eq("id", game_id).maybeSingle();

  const gameRow = {
    id: game_id,
    series_id: seriesId,
    home_team_id,
    away_team_id,
    scheduled_at: scheduled_at ?? prev?.scheduled_at ?? new Date().toISOString(),
    home_score: home_score ?? 0,
    away_score: away_score ?? 0,
    period: period ?? null,
    clock: clock ?? null,
    status: status ?? "scheduled",
    total_pim: total_pim ?? 0,
    goal_events: goal_events ?? [],
    last_updated_at: new Date().toISOString(),
  };

  await db.from("games").upsert(gameRow, { onConflict: "id" });

  // Detect new goals
  const prevCount = Array.isArray(prev?.goal_events) ? prev!.goal_events.length : 0;
  const newCount = Array.isArray(goal_events) ? goal_events.length : 0;

  if (newCount > prevCount && Array.isArray(goal_events)) {
    for (let i = prevCount; i < newCount; i++) {
      const goal = goal_events[i];
      const seq = i + 1;

      const { data: openNts } = await db
        .from("props")
        .select("id")
        .eq("game_id", game_id)
        .eq("prop_type", "next_team_to_score")
        .eq("sequence", seq)
        .eq("status", "open")
        .maybeSingle();

      if (openNts) {
        await db.from("props").update({ outcome: { team_id: goal.team_id } }).eq("id", openNts.id);
        await db.rpc("resolve_prop", { p_prop_id: openNts.id });
      }

      await db.from("activity_events").insert({
        event_type: "goal_scored",
        payload: { game_id, team_id: goal.team_id, sequence: seq },
        importance: 3,
      });

      await redis.publish(
        channels.liveProps(game_id),
        JSON.stringify({ type: "goal", sequence: seq, team_id: goal.team_id })
      );
    }

    // Open next NTS prop if game still live
    if (status === "live") {
      await db.from("props").insert({
        game_id,
        prop_type: "next_team_to_score",
        status: "open",
        points_reward: 1,
        sequence: newCount + 1,
        metadata: {
          game_id,
          goal_index: newCount + 1,
          home_team_id,
          away_team_id,
        },
      });
    }
  }

  // Update series wins when game finals
  if (status === "final" && seriesId) {
    const homeWon = (home_score ?? 0) > (away_score ?? 0);
    const awayWon = (away_score ?? 0) > (home_score ?? 0);
    if (homeWon || awayWon) {
      const { data: s } = await db.from("series").select("team_a_id, wins_a, wins_b").eq("id", seriesId).single();
      if (s) {
        const homeIsA = s.team_a_id === home_team_id;
        const winsA = (s.wins_a ?? 0) + (homeWon === homeIsA ? 1 : 0);
        const winsB = (s.wins_b ?? 0) + (awayWon === homeIsA ? 1 : 0);
        await db.from("series").update({ wins_a: winsA, wins_b: winsB, status: "live" }).eq("id", seriesId);
      }
    }
  }

  return NextResponse.json({ ok: true, new_goals: newCount - prevCount });
}
