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
    home_score,
    away_score,
    period,
    clock,
    status,
    goal_events,
    total_pim,
  } = body;

  if (!game_id) {
    return NextResponse.json({ error: "missing game_id" }, { status: 400 });
  }

  const db = createServiceClient();

  // Update the game row
  const { data: prev } = await db.from("games").select("*").eq("id", game_id).single();

  await db
    .from("games")
    .update({
      home_score,
      away_score,
      period,
      clock,
      status,
      total_pim,
      goal_events: goal_events ?? [],
      last_updated_at: new Date().toISOString(),
    })
    .eq("id", game_id);

  // Detect new goals (compare goal_events length)
  const prevCount = Array.isArray(prev?.goal_events) ? prev!.goal_events.length : 0;
  const newCount = Array.isArray(goal_events) ? goal_events.length : 0;

  if (newCount > prevCount && Array.isArray(goal_events)) {
    // For each new goal:
    // 1. Resolve any open next_team_to_score prop for this game/sequence
    // 2. Emit goal_scored activity event
    // 3. Create a fresh NTS prop for the next goal
    for (let i = prevCount; i < newCount; i++) {
      const goal = goal_events[i];
      const seq = i + 1;

      // Resolve existing NTS prop for this goal sequence
      const { data: openNts } = await db
        .from("props")
        .select("id")
        .eq("game_id", game_id)
        .eq("prop_type", "next_team_to_score")
        .eq("sequence", seq)
        .eq("status", "open")
        .maybeSingle();

      if (openNts) {
        await db
          .from("props")
          .update({
            outcome: { team_id: goal.team_id },
          })
          .eq("id", openNts.id);
        // Then resolve it via our function
        await db.rpc("resolve_prop", { p_prop_id: openNts.id });
      }

      // Emit goal activity
      await db.from("activity_events").insert({
        event_type: "goal_scored",
        payload: { game_id, team_id: goal.team_id, sequence: seq },
        importance: 3,
      });

      // Fan out to live-props channel so the UI refreshes
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
          home_team_id: prev?.home_team_id,
          away_team_id: prev?.away_team_id,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, new_goals: newCount - prevCount });
}
