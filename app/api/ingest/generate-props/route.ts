import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;



type Skater = {
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  points?: number;
  goals?: number;
  assists?: number;
  positionCode?: string;
};





async function fetchClubData(teamAbbrev: string): Promise<{
  topScorer: { name: string; team: string } | null;
  pimPerGame: number | null;
} | null> {
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/now`);
    if (!res.ok) {
      console.log("club-stats fail for " + teamAbbrev + ": " + res.status);
      return null;
    }
    const data: any = await res.json();
    const skaters: any[] = data.skaters ?? [];
    const eligible = skaters.filter((s) => s.positionCode !== "G");
    if (eligible.length === 0) return null;

    // Top scorer
    const sorted = [...eligible].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const top = sorted[0];
    const fullName = `${top.firstName?.default ?? ""} ${top.lastName?.default ?? ""}`.trim();

    // Team PIM/GP — sum all players' pim, divide by max gamesPlayed in roster
    const totalPim = skaters.reduce((sum, s) => sum + (s.penaltyMinutes ?? s.pim ?? 0), 0);
    const maxGP = skaters.reduce((max, s) => Math.max(max, s.gamesPlayed ?? 0), 0);
    const pimPerGame = maxGP > 0 ? totalPim / maxGP : null;

    console.log(teamAbbrev + ": top=" + fullName + " teamPIM=" + totalPim + " GP=" + maxGP + " PIM/GP=" + pimPerGame);

    return {
      topScorer: { name: fullName, team: teamAbbrev },
      pimPerGame,
    };
  } catch (e: any) {
    console.log("club-stats error for " + teamAbbrev + ": " + e?.message);
    return null;
  }
}

function computePimLine(homePimPerGame: number, awayPimPerGame: number): number {
  // Expected total PIMs = sum of both teams' avg per game, rounded to nearest 0.5
  const raw = homePimPerGame + awayPimPerGame;
  return Math.round(raw * 2) / 2;
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-ingest-secret");
  if (!INGEST_SECRET || secret !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const dateParam = body.date ?? new Date().toISOString().slice(0, 10);

  // Fetch schedule for the date
  const schedRes = await fetch(`https://api-web.nhle.com/v1/schedule/${dateParam}`);
  if (!schedRes.ok) {
    return NextResponse.json({ error: `Schedule fetch failed: ${schedRes.status}` }, { status: 500 });
  }
  const schedule: any = await schedRes.json();

  // Find games for this specific date (playoff only, gameType === 3)
  const dayEntry = (schedule.gameWeek ?? []).find((d: any) => d.date === dateParam);
  const games = (dayEntry?.games ?? []).filter((g: any) => g.gameType === 3);

  if (games.length === 0) {
    return NextResponse.json({ ok: true, date: dateParam, message: "No playoff games scheduled" });
  }

  // PIM map populated as we fetch each team's club-stats
  const pimMap: Record<string, number> = {};

  const supabase = createServiceClient();
  const results: any[] = [];

  for (const g of games) {
    const home = g.homeTeam.abbrev;
    const away = g.awayTeam.abbrev;
    const gameId = String(g.id);
    const gameLabel = `${away} @ ${home}`;
    const lockTime = g.startTimeUTC;

    // Idempotency: skip ONLY if THIS specific game (by NHL game_id) already has props.
    // Each playoff series has up to 7 unique gameIds, so matching on series/teams would
    // wrongly skip Games 2 through 7. NHL game_id is globally unique per game.
    const { data: existing } = await supabase
      .from("props")
      .select("id")
      .eq("game_id", gameId)
      .limit(1);
    if (existing && existing.length > 0) {
      results.push({ game: gameLabel, gameId, status: "skipped (props exist for this game_id)" });
      continue;
    }

    // Ensure game row exists (props have FK to games.id).
    // teams.id IS the team abbreviation (text), so we use the abbrevs directly.
    const { data: seriesRow } = await supabase
      .from("series")
      .select("id")
      .or(`and(team_a_id.eq.${home},team_b_id.eq.${away}),and(team_a_id.eq.${away},team_b_id.eq.${home})`)
      .maybeSingle();
    const seriesId = seriesRow?.id ?? null;
    if (!seriesId) {
      console.log(`WARN: no series found for ${gameLabel}`);
    }

    await supabase
      .from("games")
      .upsert({
        id: gameId,
        status: "scheduled",
        home_team_id: home,
        away_team_id: away,
        home_score: 0,
        away_score: 0,
        period: null,
        clock: null,
        scheduled_at: lockTime,
        series_id: seriesId,
        player_stats: [],
        total_pim: 0,
      }, { onConflict: "id" });

    const propsToInsert: any[] = [];

    // --- Fetch club data (top scorer + team PIMs) for both teams in parallel ---
    const [homeData, awayData] = await Promise.all([
      fetchClubData(home),
      fetchClubData(away),
    ]);
    const topHome = homeData?.topScorer ?? null;
    const topAway = awayData?.topScorer ?? null;
    if (homeData?.pimPerGame != null) pimMap[home] = homeData.pimPerGame;
    if (awayData?.pimPerGame != null) pimMap[away] = awayData.pimPerGame;

    if (topHome && topAway) {
      propsToInsert.push({
        prop_type: "h2h_player",
        status: "open",
        points_reward: 5,
        game_id: gameId,
        locks_at: lockTime,
        metadata: {
          stat: "points",
          game_label: gameLabel,
          player_a_name: topAway.name,
          player_a_team: topAway.team,
          player_b_name: topHome.name,
          player_b_team: topHome.team,
        },
      });
    }

    // --- PIM O/U prop: data-driven line ---
    const homePim = pimMap[home];
    const awayPim = pimMap[away];
    let line = 16.5; // fallback if data missing
    if (homePim !== undefined && awayPim !== undefined) {
      line = computePimLine(homePim, awayPim);
    }
    propsToInsert.push({
      prop_type: "game_total_pim",
      status: "open",
      points_reward: 5,
      game_id: gameId,
      locks_at: lockTime,
      metadata: {
        line: String(line),
        game_label: gameLabel,
        home_team: home,
        away_team: away,
        home_pim_per_game: homePim ?? null,
        away_pim_per_game: awayPim ?? null,
      },
    });

    const { error: insertError } = await supabase.from("props").insert(propsToInsert);
    if (insertError) {
      results.push({ game: gameLabel, status: "error", error: insertError.message });
    } else {
      results.push({
        game: gameLabel,
        status: "created",
        h2h: topHome && topAway ? `${topAway.name} vs ${topHome.name}` : "skipped",
        pim_line: line,
      });
    }
  }

  return NextResponse.json({ ok: true, date: dateParam, results });
}
