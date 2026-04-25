import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;

interface PlayerStat {
  name: string;
  team: string;
  goals: number;
  assists: number;
  points: number;
  pim: number;
  sog: number;
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-ingest-secret");
  if (!INGEST_SECRET || secret !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { game_id, status, home_team_id, away_team_id, home_score, away_score, period, clock, scheduled_at } = body;
  if (!game_id) return NextResponse.json({ error: "Missing game_id" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: prev } = await supabase
    .from("games")
    .select("home_score, away_score")
    .eq("id", game_id)
    .maybeSingle();

  const newGoals =
    Math.max((home_score ?? 0) - (prev?.home_score ?? 0), 0) +
    Math.max((away_score ?? 0) - (prev?.away_score ?? 0), 0);

  const { data: series } = await supabase
    .from("series")
    .select("id")
    .or(`and(team_a_id.eq.${home_team_id},team_b_id.eq.${away_team_id}),and(team_a_id.eq.${away_team_id},team_b_id.eq.${home_team_id})`)
    .maybeSingle();

  let playerStats: PlayerStat[] = [];
  let totalPim = 0;

  try {
    const boxRes = await fetch(`https://api-web.nhle.com/v1/gamecenter/${game_id}/boxscore`);
    if (boxRes.ok) {
      const box: any = await boxRes.json();
      const collect = (side: any, abbrev: string) => {
        if (!side) return;
        for (const grp of ["forwards", "defense", "defensemen", "goalies"]) {
          for (const p of side[grp] ?? []) {
            const name = p.name?.default ?? "";
            if (!name) continue;
            const goals = p.goals ?? 0;
            const assists = p.assists ?? 0;
            const pim = p.pim ?? p.penaltyMinutes ?? 0;
            const sog = p.sog ?? p.shots ?? 0;
            playerStats.push({ name, team: abbrev, goals, assists, points: goals + assists, pim, sog });
          }
        }
      };
      collect(box.playerByGameStats?.homeTeam, home_team_id);
      collect(box.playerByGameStats?.awayTeam, away_team_id);

      // Sum PIMs from player-level data (team-level field is unreliable)
      totalPim = playerStats.reduce((sum, p) => sum + (p.pim ?? 0), 0);
    }
  } catch (e) {
    console.error("boxscore fetch failed:", e);
  }

  const upsertPayload: any = {
    id: game_id,
    status: status ?? "live",
    home_team_id,
    away_team_id,
    home_score: home_score ?? 0,
    away_score: away_score ?? 0,
    period,
    clock,
    scheduled_at,
    series_id: series?.id ?? null,
    player_stats: playerStats,
    total_pim: totalPim,
  };

  const { error: upsertError } = await supabase
    .from("games")
    .upsert(upsertPayload, { onConflict: "id" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    new_goals: newGoals,
    player_count: playerStats.length,
    total_pim: totalPim,
  });
}
