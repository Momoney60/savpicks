import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// =============================================================================
// PROP GENERATOR v4 — Odds API single-player O/U + game winner, deterministic
// Goal: zero manual intervention. Every game gets 2 props. If Odds API fails
// or a player can't be matched to a roster, fall back to game-level totals.
// =============================================================================

type Skater = {
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  points?: number;
  goals?: number;
  assists?: number;
  shots?: number;
  penaltyMinutes?: number;
  pim?: number;
  gamesPlayed?: number;
  positionCode?: string;
  headshot?: string;
};

type Goalie = {
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  wins?: number;
  savePercentage?: number;
  gamesPlayed?: number;
  shotsAgainst?: number;
  saves?: number;
  headshot?: string;
};

type TeamClubData = {
  abbrev: string;
  skaters: Skater[];
  goalies: Goalie[];
  teamPimPerGame: number | null;
  teamGoalsPerGame: number | null;
};

type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
};

type ParsedPlayerLine = { player: string; stat: "goals" | "shots_on_goal" | "points"; line: number };

const ODDS_API_BASE = "https://api.the-odds-api.com/v4/sports/icehockey_nhl";

const ABBREV_TO_NAME: Record<string, string> = {
  ANA: "Anaheim Ducks",
  BOS: "Boston Bruins",
  BUF: "Buffalo Sabres",
  CGY: "Calgary Flames",
  CAR: "Carolina Hurricanes",
  CHI: "Chicago Blackhawks",
  COL: "Colorado Avalanche",
  CBJ: "Columbus Blue Jackets",
  DAL: "Dallas Stars",
  DET: "Detroit Red Wings",
  EDM: "Edmonton Oilers",
  FLA: "Florida Panthers",
  LAK: "Los Angeles Kings",
  MIN: "Minnesota Wild",
  MTL: "Montreal Canadiens",
  NSH: "Nashville Predators",
  NJD: "New Jersey Devils",
  NYI: "New York Islanders",
  NYR: "New York Rangers",
  OTT: "Ottawa Senators",
  PHI: "Philadelphia Flyers",
  PIT: "Pittsburgh Penguins",
  SJS: "San Jose Sharks",
  SEA: "Seattle Kraken",
  STL: "St Louis Blues",
  TBL: "Tampa Bay Lightning",
  TOR: "Toronto Maple Leafs",
  UTA: "Utah Mammoth",
  VAN: "Vancouver Canucks",
  VGK: "Vegas Golden Knights",
  WSH: "Washington Capitals",
  WPG: "Winnipeg Jets",
};

const GOALS_MIN = 4.5;
const GOALS_MAX = 7.5;

function clampGoalsLine(raw: number): number {
  const r = Math.round(raw * 2) / 2;
  return Math.max(GOALS_MIN, Math.min(GOALS_MAX, r));
}

async function fetchClubData(teamAbbrev: string): Promise<TeamClubData | null> {
  const url = `https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/20252026/2`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    const skaters: Skater[] = data.skaters ?? [];
    const goalies: Goalie[] = data.goalies ?? [];
    const eligibleSkaters = skaters.filter((s) => s.positionCode !== "G");
    if (eligibleSkaters.length === 0) return null;
    const totalGoals = skaters.reduce((sum, s) => sum + (s.goals ?? 0), 0);
    const maxGP = skaters.reduce((max, s) => Math.max(max, s.gamesPlayed ?? 0), 0);
    const teamGoalsPerGame = maxGP > 0 ? totalGoals / maxGP : null;
    return { abbrev: teamAbbrev, skaters: eligibleSkaters, goalies, teamPimPerGame: null, teamGoalsPerGame };
  } catch {
    return null;
  }
}

function headshotUrl(playerId: number, teamAbbrev: string): string {
  return `https://assets.nhle.com/mugs/nhl/20252026/${teamAbbrev}/${playerId}.png`;
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findSkaterByName(name: string, ...teams: TeamClubData[]): { player: Skater; team: TeamClubData } | null {
  const target = normName(name);
  const targetParts = target.split(" ");
  const lastTarget = targetParts[targetParts.length - 1];

  for (const team of teams) {
    for (const p of team.skaters) {
      const full = normName(`${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`);
      if (full === target) return { player: p, team };
    }
  }
  for (const team of teams) {
    for (const p of team.skaters) {
      const last = normName(p.lastName?.default ?? "");
      if (last && last === lastTarget) return { player: p, team };
    }
  }
  return null;
}

async function fetchOddsApiEvents(): Promise<OddsApiEvent[]> {
  if (!ODDS_API_KEY) return [];
  try {
    const res = await fetch(`${ODDS_API_BASE}/events?apiKey=${ODDS_API_KEY}`);
    if (!res.ok) {
      console.log(`[odds-api] events fetch failed: ${res.status} ${res.statusText}`);
      return [];
    }
    return (await res.json()) as OddsApiEvent[];
  } catch (e: any) {
    console.log(`[odds-api] events fetch exception: ${e?.message}`);
    return [];
  }
}

async function fetchOddsApiPlayerProps(eventId: string): Promise<ParsedPlayerLine[]> {
  if (!ODDS_API_KEY) return [];
  const markets = "player_goals,player_shots_on_goal,player_points";
  const url = `${ODDS_API_BASE}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&oddsFormat=american`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`[odds-api] event ${eventId} props failed: ${res.status}`);
      return [];
    }
    const data: any = await res.json();
    const out: ParsedPlayerLine[] = [];
    const seen = new Set<string>();
    for (const bm of data.bookmakers ?? []) {
      for (const m of bm.markets ?? []) {
        let stat: ParsedPlayerLine["stat"] | null = null;
        if (m.key === "player_goals") stat = "goals";
        else if (m.key === "player_shots_on_goal") stat = "shots_on_goal";
        else if (m.key === "player_points") stat = "points";
        if (!stat) continue;
        for (const o of m.outcomes ?? []) {
          const sideCandidate = String(o.name ?? "").toLowerCase();
          const isSide = sideCandidate === "over" || sideCandidate === "under";
          const player = isSide ? o.description : o.name;
          const point = typeof o.point === "number" ? o.point : parseFloat(o.point ?? "");
          if (!player || !Number.isFinite(point)) continue;
          const key = `${player}|${stat}|${point}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ player, stat, line: point });
        }
      }
    }
    return out;
  } catch (e: any) {
    console.log(`[odds-api] event ${eventId} props exception: ${e?.message}`);
    return [];
  }
}

function matchOddsEventToGame(events: OddsApiEvent[], home: string, away: string, scheduledAt: string): OddsApiEvent | null {
  const homeName = ABBREV_TO_NAME[home];
  const awayName = ABBREV_TO_NAME[away];
  if (!homeName || !awayName) return null;
  const target = new Date(scheduledAt).getTime();
  const candidates = events.filter(
    (e) =>
      ((e.home_team === homeName && e.away_team === awayName) ||
        (e.home_team === awayName && e.away_team === homeName)) &&
      Math.abs(new Date(e.commence_time).getTime() - target) < 24 * 60 * 60 * 1000,
  );
  candidates.sort(
    (a, b) =>
      Math.abs(new Date(a.commence_time).getTime() - target) -
      Math.abs(new Date(b.commence_time).getTime() - target),
  );
  return candidates[0] ?? null;
}

function pickPlayerProp(
  lines: ParsedPlayerLine[],
  home: TeamClubData,
  away: TeamClubData,
): {
  stat: ParsedPlayerLine["stat"];
  line: number;
  player_name: string;
  player_team: string;
  player_id: number;
  player_headshot: string;
} | null {
  const statRank: Record<ParsedPlayerLine["stat"], number> = { goals: 0, shots_on_goal: 1, points: 2 };

  const grouped = new Map<string, { player: string; stat: ParsedPlayerLine["stat"]; lines: number[] }>();
  for (const l of lines) {
    const k = `${l.player}|${l.stat}`;
    const entry = grouped.get(k);
    if (entry) entry.lines.push(l.line);
    else grouped.set(k, { player: l.player, stat: l.stat, lines: [l.line] });
  }

  const candidates = Array.from(grouped.values())
    .map((g) => {
      const sorted = [...g.lines].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return { player: g.player, stat: g.stat, line: median };
    })
    .filter((c) => {
      if (c.stat === "goals") return c.line === 0.5 || c.line === 1.5;
      if (c.stat === "shots_on_goal") return c.line >= 1.5 && c.line <= 4.5;
      if (c.stat === "points") return c.line >= 0.5 && c.line <= 2.5;
      return false;
    })
    .sort((a, b) => statRank[a.stat] - statRank[b.stat]);

  for (const c of candidates) {
    const match = findSkaterByName(c.player, home, away);
    if (!match) continue;
    return {
      stat: c.stat,
      line: c.line,
      player_name: `${match.player.firstName?.default ?? ""} ${match.player.lastName?.default ?? ""}`.trim(),
      player_team: match.team.abbrev,
      player_id: match.player.playerId,
      player_headshot: headshotUrl(match.player.playerId, match.team.abbrev),
    };
  }
  return null;
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

  const schedRes = await fetch(`https://api-web.nhle.com/v1/schedule/${dateParam}`);
  if (!schedRes.ok) {
    return NextResponse.json({ error: `Schedule fetch failed: ${schedRes.status}` }, { status: 500 });
  }
  const schedule: any = await schedRes.json();
  const dayEntry = (schedule.gameWeek ?? []).find((d: any) => d.date === dateParam);
  const games = (dayEntry?.games ?? []).filter((g: any) => g.gameType === 3);
  if (games.length === 0) {
    return NextResponse.json({ ok: true, date: dateParam, message: "No playoff games scheduled" });
  }

  const supabase = createServiceClient();
  const oddsEvents = await fetchOddsApiEvents();
  const oddsAvailable = oddsEvents.length > 0;
  const results: any[] = [];

  for (const g of games) {
    const home = g.homeTeam.abbrev;
    const away = g.awayTeam.abbrev;
    const gameId = String(g.id);
    const gameLabel = `${away} @ ${home}`;
    const lockTime = g.startTimeUTC;

    const { data: existing } = await supabase
      .from("props")
      .select("id")
      .eq("game_id", gameId)
      .limit(1);
    if (existing && existing.length > 0) {
      results.push({ game: gameLabel, gameId, status: "skipped (props exist)" });
      continue;
    }

    const { data: seriesRow } = await supabase
      .from("series")
      .select("id, wins_a, wins_b, team_a_id, team_b_id")
      .or(`and(team_a_id.eq.${home},team_b_id.eq.${away}),and(team_a_id.eq.${away},team_b_id.eq.${home})`)
      .maybeSingle();
    const seriesId = seriesRow?.id ?? null;

    await supabase.from("games").upsert(
      {
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
      },
      { onConflict: "id" }
    );

    const [homeData, awayData] = await Promise.all([fetchClubData(home), fetchClubData(away)]);

    const propsToInsert: any[] = [];
    const descriptions: string[] = [];

    let playerOuBuilt = false;
    if (oddsAvailable && homeData && awayData) {
      const event = matchOddsEventToGame(oddsEvents, home, away, lockTime);
      if (event) {
        const lines = await fetchOddsApiPlayerProps(event.id);
        if (lines.length > 0) {
          const pick = pickPlayerProp(lines, homeData, awayData);
          if (pick) {
            propsToInsert.push({
              prop_type: "player_ou",
              status: "open",
              points_reward: 5,
              game_id: gameId,
              locks_at: lockTime,
              metadata: {
                stat: pick.stat,
                line: String(pick.line),
                game_label: gameLabel,
                home_team: home,
                away_team: away,
                player_name: pick.player_name,
                player_team: pick.player_team,
                player_id: pick.player_id,
                player_headshot: pick.player_headshot,
              },
            });
            descriptions.push(`Player O/U: ${pick.player_name} ${pick.stat} ${pick.line}`);
            playerOuBuilt = true;
          }
        }
      }
    }

    if (!playerOuBuilt) {
      const seasonGoals = (homeData?.teamGoalsPerGame ?? 0) + (awayData?.teamGoalsPerGame ?? 0);
      const goalsRaw = seasonGoals > 0 ? 0.5 * seasonGoals + 0.5 * 5.5 : 5.5;
      const goalsLine = clampGoalsLine(goalsRaw);
      propsToInsert.push({
        prop_type: "game_total_goals",
        status: "open",
        points_reward: 5,
        game_id: gameId,
        locks_at: lockTime,
        metadata: {
          line: String(goalsLine),
          game_label: gameLabel,
          home_team: home,
          away_team: away,
        },
      });
      descriptions.push(`Total Goals O/U ${goalsLine} (fallback)`);
    }

    propsToInsert.push({
      prop_type: "game_winner",
      status: "open",
      points_reward: 5,
      game_id: gameId,
      locks_at: lockTime,
      metadata: {
        game_label: gameLabel,
        home_team: home,
        away_team: away,
      },
    });
    descriptions.push("Game winner");

    const { error: insertError } = await supabase.from("props").insert(propsToInsert);
    if (insertError) {
      results.push({ game: gameLabel, status: "error", error: insertError.message });
    } else {
      results.push({ game: gameLabel, gameId, status: "created", props: descriptions });
    }
  }

  return NextResponse.json({ ok: true, date: dateParam, oddsAvailable, results });
}