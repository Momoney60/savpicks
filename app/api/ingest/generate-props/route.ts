import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

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
      const bmKey = bm.key ?? "";
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
          const key = `${bmKey}|${player}|${stat}|${point}`;
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

type PropCandidate = {
  player: string;
  stat: ParsedPlayerLine["stat"];
  line: number;
  books: number;
  playerCoverage: number;
};

function buildCandidates(lines: ParsedPlayerLine[]): PropCandidate[] {
  const players = new Map<string, Map<ParsedPlayerLine["stat"], Map<number, number>>>();
  for (const l of lines) {
    if (!players.has(l.player)) players.set(l.player, new Map());
    const stats = players.get(l.player)!;
    if (!stats.has(l.stat)) stats.set(l.stat, new Map());
    const lineCounts = stats.get(l.stat)!;
    lineCounts.set(l.line, (lineCounts.get(l.line) ?? 0) + 1);
  }

  const all: PropCandidate[] = [];
  for (const [player, stats] of players) {
    let playerCoverage = 0;
    const playerCands: PropCandidate[] = [];
    for (const [stat, lineCounts] of stats) {
      let modeLine = 0;
      let modeBooks = 0;
      for (const [line, books] of lineCounts) {
        if (books > modeBooks) { modeLine = line; modeBooks = books; }
      }
      playerCoverage += modeBooks;
      const valid =
        (stat === "goals" && modeLine === 0.5) ||
        (stat === "shots_on_goal" && modeLine >= 1.5 && modeLine <= 4.5) ||
        (stat === "points" && modeLine >= 0.5 && modeLine <= 2.5);
      if (valid) playerCands.push({ player, stat, line: modeLine, books: modeBooks, playerCoverage: 0 });
    }
    for (const c of playerCands) c.playerCoverage = playerCoverage;
    all.push(...playerCands);
  }
  return all;
}

function weightedRandom<T extends { books: number }>(items: T[]): T {
  const total = items.reduce((s, x) => s + x.books, 0);
  if (total === 0) return items[0];
  let r = Math.random() * total;
  for (const x of items) {
    r -= x.books;
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

type SoloPick = {
  kind: "solo";
  stat: ParsedPlayerLine["stat"];
  line: number;
  player_name: string;
  player_team: string;
  player_id: number;
  player_headshot: string;
  debug: { player_coverage: number; books_for_stat: number; total_candidates: number };
};

type H2HPick = {
  kind: "h2h";
  stat: "shots" | "points";
  line: number;
  player_a_name: string; player_a_team: string; player_a_id: number; player_a_headshot: string;
  player_b_name: string; player_b_team: string; player_b_id: number; player_b_headshot: string;
  debug: { pair_coverage: number; pair_books: number; h2h_pairs: number };
};

function pickPlayerProp(
  lines: ParsedPlayerLine[],
  home: TeamClubData,
  away: TeamClubData,
): SoloPick | H2HPick | null {
  const candidates = buildCandidates(lines);
  if (candidates.length === 0) return null;

  type Tagged = PropCandidate & { teamAbbrev: string; nhlPlayerId: number; headshot: string; resolvedName: string };
  const tagged: Tagged[] = [];
  for (const c of candidates) {
    const match = findSkaterByName(c.player, home, away);
    if (!match) continue;
    tagged.push({
      ...c,
      teamAbbrev: match.team.abbrev,
      nhlPlayerId: match.player.playerId,
      headshot: headshotUrl(match.player.playerId, match.team.abbrev),
      resolvedName: `${match.player.firstName?.default ?? ""} ${match.player.lastName?.default ?? ""}`.trim(),
    });
  }

  // H2H pass: pairs (one player per team) with SAME stat + SAME line. Skip goals.
  const homeCands = tagged.filter((c) => c.teamAbbrev === home.abbrev);
  const awayCands = tagged.filter((c) => c.teamAbbrev === away.abbrev);
  type Pair = { home: Tagged; away: Tagged; weight: number; coverage: number };
  const pairs: Pair[] = [];
  for (const h of homeCands) {
    if (h.stat === "goals") continue;
    for (const a of awayCands) {
      if (a.stat !== h.stat) continue;
      if (a.line !== h.line) continue;
      pairs.push({
        home: h,
        away: a,
        weight: h.books + a.books,
        coverage: h.playerCoverage + a.playerCoverage,
      });
    }
  }

  if (pairs.length > 0) {
    pairs.sort((x, y) => y.coverage - x.coverage || y.weight - x.weight);
    const topPairs = pairs.slice(0, Math.min(5, pairs.length));
    const pool = topPairs.map((p) => ({ ...p, books: p.weight }));
    const chosen = weightedRandom(pool);
    return {
      kind: "h2h",
      stat: chosen.home.stat === "shots_on_goal" ? "shots" : "points",
      line: chosen.home.line,
      player_a_name: chosen.away.resolvedName,
      player_a_team: chosen.away.teamAbbrev,
      player_a_id: chosen.away.nhlPlayerId,
      player_a_headshot: chosen.away.headshot,
      player_b_name: chosen.home.resolvedName,
      player_b_team: chosen.home.teamAbbrev,
      player_b_id: chosen.home.nhlPlayerId,
      player_b_headshot: chosen.home.headshot,
      debug: { pair_coverage: chosen.coverage, pair_books: chosen.weight, h2h_pairs: pairs.length },
    };
  }

  // Solo fallback
  candidates.sort((a, b) => b.playerCoverage - a.playerCoverage || b.books - a.books);
  const top = candidates.slice(0, Math.min(8, candidates.length));
  const soloPool = [...top];
  while (soloPool.length > 0) {
    const chosen = weightedRandom(soloPool);
    const match = findSkaterByName(chosen.player, home, away);
    if (match) {
      return {
        kind: "solo",
        stat: chosen.stat,
        line: chosen.line,
        player_name: `${match.player.firstName?.default ?? ""} ${match.player.lastName?.default ?? ""}`.trim(),
        player_team: match.team.abbrev,
        player_id: match.player.playerId,
        player_headshot: headshotUrl(match.player.playerId, match.team.abbrev),
        debug: { player_coverage: chosen.playerCoverage, books_for_stat: chosen.books, total_candidates: candidates.length },
      };
    }
    const idx = soloPool.indexOf(chosen);
    soloPool.splice(idx, 1);
  }
  return null;
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-ingest-secret");
  if (!INGEST_SECRET || secret !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date?: string; dry_run?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const dateParam = body.date ?? new Date().toISOString().slice(0, 10);
  const dryRun = body.dry_run === true;

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

    if (!dryRun) {
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
    }

    const [homeData, awayData] = await Promise.all([fetchClubData(home), fetchClubData(away)]);

    const propsToInsert: any[] = [];
    const descriptions: string[] = [];

    let playerOuBuilt = false;
    let debugInfo: any = null;
    if (oddsAvailable && homeData && awayData) {
      const event = matchOddsEventToGame(oddsEvents, home, away, lockTime);
      if (event) {
        const lines = await fetchOddsApiPlayerProps(event.id);
        if (lines.length > 0) {
          const pick = pickPlayerProp(lines, homeData, awayData);
          if (dryRun) {
            const allCands = buildCandidates(lines)
              .sort((a, b) => b.playerCoverage - a.playerCoverage || b.books - a.books)
              .slice(0, 15);
            debugInfo = {
              event_id: event.id,
              raw_lines_count: lines.length,
              top_candidates: allCands.map((c) => ({
                player: c.player,
                stat: c.stat,
                line: c.line,
                books_for_this_stat: c.books,
                total_player_coverage: c.playerCoverage,
              })),
              chosen: pick
                ? pick.kind === "solo"
                  ? { kind: "solo", player: pick.player_name, stat: pick.stat, line: pick.line, debug: pick.debug }
                  : { kind: "h2h", away: pick.player_a_name, home: pick.player_b_name, stat: pick.stat, line: pick.line, debug: pick.debug }
                : null,
            };
          }
          if (pick && pick.kind === "solo") {
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
          } else if (pick && pick.kind === "h2h") {
            propsToInsert.push({
              prop_type: "h2h_player",
              status: "open",
              points_reward: 5,
              game_id: gameId,
              locks_at: lockTime,
              metadata: {
                stat: pick.stat,
                game_label: gameLabel,
                home_team: home,
                away_team: away,
                line: String(pick.line),
                player_a_name: pick.player_a_name,
                player_a_team: pick.player_a_team,
                player_a_id: pick.player_a_id,
                player_a_headshot: pick.player_a_headshot,
                player_b_name: pick.player_b_name,
                player_b_team: pick.player_b_team,
                player_b_id: pick.player_b_id,
                player_b_headshot: pick.player_b_headshot,
              },
            });
            descriptions.push(`H2H ${pick.stat}: ${pick.player_a_name} vs ${pick.player_b_name} (line ${pick.line})`);
            playerOuBuilt = true;
          }
        } else if (dryRun) {
          debugInfo = { event_id: event.id, raw_lines_count: 0, note: "Odds API returned no player markets for this event" };
        }
      } else if (dryRun) {
        debugInfo = { note: `No Odds API event matched ${away} @ ${home}` };
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

    if (dryRun) {
      results.push({
        game: gameLabel,
        gameId,
        status: "dry_run",
        props: descriptions,
        debug: debugInfo,
      });
      continue;
    }

    const { error: insertError } = await supabase.from("props").insert(propsToInsert);
    if (insertError) {
      results.push({ game: gameLabel, status: "error", error: insertError.message });
    } else {
      results.push({ game: gameLabel, gameId, status: "created", props: descriptions });
    }
  }

  return NextResponse.json({ ok: true, date: dateParam, oddsAvailable, dryRun, results });
}