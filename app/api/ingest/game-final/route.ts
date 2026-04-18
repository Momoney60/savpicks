import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;

export async function POST(request: Request) {
  const secret = request.headers.get("x-ingest-secret");
  if (!INGEST_SECRET || secret !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { game_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { game_id } = body;
  if (!game_id) {
    return NextResponse.json({ error: "Missing game_id" }, { status: 400 });
  }

  // Fetch NHL boxscore
  const boxRes = await fetch(`https://api-web.nhle.com/v1/gamecenter/${game_id}/boxscore`);
  if (!boxRes.ok) {
    return NextResponse.json(
      { error: `Box fetch failed: ${boxRes.status}` },
      { status: 500 }
    );
  }
  const box: any = await boxRes.json();

  // Verify game is final
  if (box.gameState !== "OFF" && box.gameState !== "FINAL" && box.gameState !== "OVER") {
    return NextResponse.json({
      ok: false,
      message: `Game not final yet (state: ${box.gameState})`,
    });
  }

  const homeAbbrev = box.homeTeam?.abbrev;
  const awayAbbrev = box.awayTeam?.abbrev;
  const homeScore = box.homeTeam?.score ?? 0;
  const awayScore = box.awayTeam?.score ?? 0;
  const homePIM = box.homeTeam?.pim ?? box.homeTeam?.sog ?? 0;
  const awayPIM = box.awayTeam?.pim ?? 0;
  const totalPIM = homePIM + awayPIM;

  // Build player scoring lookup: { fullName.toLowerCase(): { goals, assists, points } }
  const playerStats: Record<string, { points: number; team: string }> = {};
  const collectPlayers = (teamSide: any, teamAbbrev: string) => {
    if (!teamSide) return;
    const groups = ["forwards", "defense", "defensemen", "goalies"];
    for (const grp of groups) {
      for (const p of teamSide[grp] ?? []) {
        const name = (p.name?.default ?? "").toLowerCase().trim();
        if (!name) continue;
        const goals = p.goals ?? 0;
        const assists = p.assists ?? 0;
        playerStats[name] = { points: goals + assists, team: teamAbbrev };
      }
    }
  };
  collectPlayers(box.playerByGameStats?.homeTeam, homeAbbrev);
  collectPlayers(box.playerByGameStats?.awayTeam, awayAbbrev);

  const supabase = createServiceClient();

  // 1. Update game row
  await supabase
    .from("games")
    .update({
      status: "final",
      home_score: homeScore,
      away_score: awayScore,
      period: "Final",
      clock: null,
    })
    .eq("id", game_id);

  // 2. Find all props attached to this game OR matching the game label
  const labelPrefixes = [
    `${awayAbbrev} @ ${homeAbbrev}`,
    `${homeAbbrev} @ ${awayAbbrev}`,
  ];

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
      const aPts = playerStats[aName]?.points ?? 0;
      const bPts = playerStats[bName]?.points ?? 0;
      const winner = aPts > bPts ? "a" : bPts > aPts ? "b" : "tie";
      outcome = { winner, player_a_pts: aPts, player_b_pts: bPts };
    } else if (prop.prop_type === "game_total_pim") {
      const line = parseFloat(prop.metadata?.line ?? "0");
      const result = totalPIM > line ? "over" : totalPIM < line ? "under" : "push";
      outcome = { result, total_pim: totalPIM };
    } else if (prop.prop_type === "next_team_to_score") {
      // skip — handled live, just void any open ones
      await supabase
        .from("props")
        .update({ status: "void", resolved_at: new Date().toISOString() })
        .eq("id", prop.id);
      continue;
    } else {
      continue;
    }

    // Set outcome and call resolve_prop()
    await supabase
      .from("props")
      .update({ outcome, status: "locked" })
      .eq("id", prop.id);

    const { error: rpcError } = await supabase.rpc("resolve_prop", { p_prop_id: prop.id });

    resolved.push({
      prop_id: prop.id,
      type: prop.prop_type,
      outcome,
      error: rpcError?.message,
    });
  }

  return NextResponse.json({
    ok: true,
    game_id,
    final: { home: `${homeAbbrev} ${homeScore}`, away: `${awayAbbrev} ${awayScore}`, totalPIM },
    resolved,
  });
}
