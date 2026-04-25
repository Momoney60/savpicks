import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;

type PlayerStat = {
  name: string;
  team: string;
  goals: number;
  assists: number;
  points: number;
  pim: number;
};

type GoalieStat = {
  name: string;
  team: string;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  toi: string;
  starter: boolean;
};

function parseSaves(p: any): { saves: number; shotsAgainst: number; goalsAgainst: number } {
  // saveShotsAgainst is a string like "28/30" (saves / shots)
  const ssa: string = p.saveShotsAgainst ?? "";
  let saves = 0;
  let shotsAgainst = 0;
  if (ssa.includes("/")) {
    const [s, sh] = ssa.split("/").map((x: string) => parseInt(x.trim() || "0", 10));
    saves = s || 0;
    shotsAgainst = sh || 0;
  } else {
    shotsAgainst = p.shotsAgainst ?? 0;
    saves = shotsAgainst - (p.goalsAgainst ?? 0);
  }
  return { saves, shotsAgainst, goalsAgainst: p.goalsAgainst ?? 0 };
}

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

  const playerStats: PlayerStat[] = [];
  const playerLookup: Record<string, { points: number; team: string; pim: number; shots: number }> = {};
  const goalieLookup: Record<string, GoalieStat> = {};

  const collect = (side: any, abbrev: string) => {
    if (!side) return;
    for (const grp of ["forwards", "defense", "defensemen"]) {
      for (const p of side[grp] ?? []) {
        const name = p.name?.default ?? "";
        if (!name) continue;
        const goals = p.goals ?? 0;
        const assists = p.assists ?? 0;
        const pim = p.pim ?? p.penaltyMinutes ?? 0;
        const shots = p.sog ?? p.shots ?? 0;
        const points = goals + assists;
        playerStats.push({ name, team: abbrev, goals, assists, points, pim, sog: shots });
        playerLookup[name.toLowerCase().trim()] = { points, team: abbrev, pim, shots };
      }
    }
    for (const p of side.goalies ?? []) {
      const name = p.name?.default ?? "";
      if (!name) continue;
      const { saves, shotsAgainst, goalsAgainst } = parseSaves(p);
      goalieLookup[name.toLowerCase().trim()] = {
        name,
        team: abbrev,
        saves,
        shotsAgainst,
        goalsAgainst,
        toi: p.toi ?? "",
        starter: p.starter ?? false,
      };
      // Also include goalie in playerStats (for pim aggregation)
      playerStats.push({
        name,
        team: abbrev,
        goals: 0,
        assists: 0,
        points: 0,
        pim: p.pim ?? p.penaltyMinutes ?? 0,
      });
    }
  };
  collect(box.playerByGameStats?.homeTeam, homeAbbrev);
  collect(box.playerByGameStats?.awayTeam, awayAbbrev);

  const totalPim = playerStats.reduce((sum, p) => sum + (p.pim ?? 0), 0);
  const totalGoals = homeScore + awayScore;

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

  // Strict game_id match — no more fuzzy game_label LIKE (prevents cross-game pollution)
  const { data: props } = await supabase
    .from("props")
    .select("*")
    .eq("game_id", game_id)
    .neq("status", "resolved");

  const resolved: any[] = [];
  const getLast = (full: string) => {
    const parts = (full ?? "").trim().toLowerCase().split(/\s+/);
    return parts[parts.length - 1] ?? "";
  };

  for (const prop of props ?? []) {
    let outcome: any = null;

    if (prop.prop_type === "h2h_player") {
      const stat = prop.metadata?.stat ?? "points";
      const aLast = getLast(prop.metadata?.player_a_name ?? "");
      const bLast = getLast(prop.metadata?.player_b_name ?? "");
      const aEntry = Object.entries(playerLookup).find(([k]) => getLast(k) === aLast);
      const bEntry = Object.entries(playerLookup).find(([k]) => getLast(k) === bLast);
      const readStat = (entry: any) => {
        if (!entry) return 0;
        if (stat === "pim") return entry[1]?.pim ?? 0;
        if (stat === "shots") return entry[1]?.shots ?? 0;
        return entry[1]?.points ?? 0;
      };
      const aVal = readStat(aEntry);
      const bVal = readStat(bEntry);
      const winner = aVal > bVal ? "a" : bVal > aVal ? "b" : "tie";
      outcome = { winner, stat, player_a_value: aVal, player_b_value: bVal };

    } else if (prop.prop_type === "h2h_goalie") {
      const aLast = getLast(prop.metadata?.player_a_name ?? "");
      const bLast = getLast(prop.metadata?.player_b_name ?? "");
      const aEntry = Object.entries(goalieLookup).find(([k]) => getLast(k) === aLast);
      const bEntry = Object.entries(goalieLookup).find(([k]) => getLast(k) === bLast);
      const aSaves = aEntry?.[1]?.saves ?? 0;
      const bSaves = bEntry?.[1]?.saves ?? 0;
      const winner = aSaves > bSaves ? "a" : bSaves > aSaves ? "b" : "tie";
      outcome = { winner, stat: "saves", player_a_value: aSaves, player_b_value: bSaves };

    } else if (prop.prop_type === "game_total_pim") {
      const line = parseFloat(prop.metadata?.line ?? "0");
      const result = totalPim > line ? "over" : totalPim < line ? "under" : "push";
      outcome = { result, total_pim: totalPim, line };

    } else if (prop.prop_type === "game_total_goals") {
      const line = parseFloat(prop.metadata?.line ?? "0");
      const result = totalGoals > line ? "over" : totalGoals < line ? "under" : "push";
      outcome = { result, total_goals: totalGoals, line };

    } else if (prop.prop_type === "game_winner") {
      // Picker choice is stored as team abbrev (home_team or away_team)
      const winnerAbbrev = homeScore > awayScore ? homeAbbrev : awayScore > homeScore ? awayAbbrev : "tie";
      outcome = { winner_team: winnerAbbrev, home_score: homeScore, away_score: awayScore, home_team: homeAbbrev, away_team: awayAbbrev };

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
    final: {
      home: `${homeAbbrev} ${homeScore}`,
      away: `${awayAbbrev} ${awayScore}`,
      totalPIM: totalPim,
      totalGoals,
    },
    resolved,
  });
}
