import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;

export async function POST(request: Request) {
  const secret = request.headers.get("x-ingest-secret");
  if (!INGEST_SECRET || secret !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { game_id } = body;
  if (!game_id) return NextResponse.json({ error: "Missing game_id" }, { status: 400 });

  const boxRes = await fetch(`https://api-web.nhle.com/v1/gamecenter/${game_id}/boxscore`);
  if (!boxRes.ok) {
    return NextResponse.json({ error: `Box fetch failed: ${boxRes.status}` }, { status: 500 });
  }
  const box: any = await boxRes.json();

  if (box.gameState !== "OFF" && box.gameState !== "FINAL" && box.gameState !== "OVER") {
    return NextResponse.json({ ok: false, message: `Game not final yet (${box.gameState})` });
  }

  const homeAbbrev = box.homeTeam?.abbrev;
  const awayAbbrev = box.awayTeam?.abbrev;
  const homeScore = box.homeTeam?.score ?? 0;
  const awayScore = box.awayTeam?.score ?? 0;

  // Build player stats from boxscore
  const playerStats: { name: string; team: string; goals: number; assists: number; points: number; pim: number; }[] = [];
  const playerLookup: Record<string, { points: number; team: string; pim: number }> = {};

  const collect = (side: any, abbrev: string) => {
    if (!side) return;
    for (const grp of ["forwards", "defense", "defensemen", "goalies"]) {
      for (const p of side[grp] ?? []) {
        const name = p.name?.default ?? "";
        if (!name) continue;
        const goals = p.goals ?? 0;
        const assists = p.assists ?? 0;
        const pim = p.pim ?? p.penaltyMinutes ?? 0;
        const points = goals + assists;
        playerStats.push({ name, team: abbrev, goals, assists, points, pim });
        playerLookup[name.toLowerCase().trim()] = { points, team: abbrev, pim };
      }
    }
  };
  collect(box.playerByGameStats?.homeTeam, homeAbbrev);
  collect(box.playerByGameStats?.awayTeam, awayAbbrev);

  const totalPim = playerStats.reduce((sum, p) => sum + (p.pim ?? 0), 0);

  const supabase = createServiceClient();

  await supabase
    .from("games")
    .update({
      status: "final",
      home_score: homeScore,
      away_score: awayScore,
      period: "Final",
      clock: null,
      player_stats: playerStats,
      total_pim: totalPim,
    })
    .eq("id", game_id);

  // Find props for this game
  const labelPrefixes = [`${awayAbbrev} @ ${homeAbbrev}`, `${homeAbbrev} @ ${awayAbbrev}`];
  const { data: props } = await supabase
    .from("props")
    .select("*")
    .or(`game_id.eq.${game_id},metadata->>game_label.like.${labelPrefixes[0]}%,metadata->>game_label.like.${labelPrefixes[1]}%`)
    .neq("status", "resolved");

  const resolved: any[] = [];

  for (const prop of props ?? []) {
    let outcome: any = null;

    if (prop.prop_type === "h2h_player") {
      const aName = (prop.metadata?.player_a_name ?? "").toLowerCase().trim();
      const bName = (prop.metadata?.player_b_name ?? "").toLowerCase().trim();
      const aPts = playerLookup[aName]?.points ?? 0;
      const bPts = playerLookup[bName]?.points ?? 0;
      const winner = aPts > bPts ? "a" : bPts > aPts ? "b" : "tie";
      outcome = { winner, player_a_pts: aPts, player_b_pts: bPts };
    } else if (prop.prop_type === "game_total_pim") {
      const line = parseFloat(prop.metadata?.line ?? "0");
      const result = totalPim > line ? "over" : totalPim < line ? "under" : "push";
      outcome = { result, total_pim: totalPim };
    } else if (prop.prop_type === "next_team_to_score") {
      await supabase.from("props").update({ status: "void", resolved_at: new Date().toISOString() }).eq("id", prop.id);
      continue;
    } else {
      continue;
    }

    await supabase.from("props").update({ outcome, status: "locked" }).eq("id", prop.id);
    const { error: rpcError } = await supabase.rpc("resolve_prop", { p_prop_id: prop.id });
    resolved.push({ prop_id: prop.id, type: prop.prop_type, outcome, error: rpcError?.message });
  }

  return NextResponse.json({
    ok: true,
    game_id,
    final: { home: `${homeAbbrev} ${homeScore}`, away: `${awayAbbrev} ${awayScore}`, totalPIM: totalPim },
    resolved,
  });
}
