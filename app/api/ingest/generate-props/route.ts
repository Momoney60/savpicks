import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;

// NHL numeric teamId -> abbreviation (stable, 32 franchises)
const TEAM_ID_TO_ABBREV: Record<number, string> = {
  1: "NJD", 2: "NYI", 3: "NYR", 4: "PHI", 5: "PIT", 6: "BOS", 7: "BUF",
  8: "MTL", 9: "OTT", 10: "TOR", 12: "CAR", 13: "FLA", 14: "TBL", 15: "WSH",
  16: "CHI", 17: "DET", 18: "NSH", 19: "STL", 20: "CGY", 21: "COL", 22: "EDM",
  23: "VAN", 24: "ANA", 25: "DAL", 26: "LAK", 28: "SJS", 29: "CBJ", 30: "MIN",
  52: "WPG", 54: "VGK", 55: "SEA", 59: "UTA", 68: "UTA",
};

type Skater = {
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  points?: number;
  goals?: number;
  assists?: number;
  positionCode?: string;
};

async function fetchTopScorer(teamAbbrev: string): Promise<{ name: string; team: string } | null> {
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/now`);
    if (!res.ok) return null;
    const data: any = await res.json();
    const skaters: Skater[] = data.skaters ?? [];
    const eligible = skaters.filter((s) => s.positionCode !== "G");
    if (eligible.length === 0) return null;
    eligible.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const top = eligible[0];
    const fullName = `${top.firstName?.default ?? ""} ${top.lastName?.default ?? ""}`.trim();
    return { name: fullName, team: teamAbbrev };
  } catch {
    return null;
  }
}

async function fetchTeamPimsPerGame(): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  try {
    const url = "https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026%20and%20gameTypeId=2";
    const res = await fetch(url);
    if (!res.ok) return map;
    const data: any = await res.json();
    for (const team of data.data ?? []) {
      const abbrev = TEAM_ID_TO_ABBREV[team.teamId];
      const gp = team.gamesPlayed ?? 0;
      const pim = team.penaltyMinutes ?? 0;
      if (abbrev && gp > 0) {
        map[abbrev] = pim / gp;
      }
    }
  } catch {
    // ignore
  }
  return map;
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

  // Preload team PIM/GP for all teams (single request)
  const pimMap = await fetchTeamPimsPerGame();

  const supabase = createServiceClient();
  const results: any[] = [];

  for (const g of games) {
    const home = g.homeTeam.abbrev;
    const away = g.awayTeam.abbrev;
    const gameId = String(g.id);
    const gameLabel = `${away} @ ${home}`;
    const lockTime = g.startTimeUTC;

    // Idempotency: skip if ANY prop already references this game
    const { data: existing } = await supabase
      .from("props")
      .select("id")
      .or(`game_id.eq.${gameId},metadata->>game_label.like.${gameLabel}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      results.push({ game: gameLabel, status: "skipped (props exist)" });
      continue;
    }

    // Ensure game row exists (props have FK to games.id)
    const { data: seriesRow } = await supabase
      .from("series")
      .select("id")
      .or(`and(team_a_id.eq.${home},team_b_id.eq.${away}),and(team_a_id.eq.${away},team_b_id.eq.${home})`)
      .maybeSingle();

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
        series_id: seriesRow?.id ?? null,
        player_stats: [],
        total_pim: 0,
      }, { onConflict: "id" });

    const propsToInsert: any[] = [];

    // --- H2H prop: top scorer home vs top scorer away ---
    const [topHome, topAway] = await Promise.all([
      fetchTopScorer(home),
      fetchTopScorer(away),
    ]);

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
