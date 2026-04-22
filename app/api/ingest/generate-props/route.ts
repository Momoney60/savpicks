import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;

// =============================================================================
// PROP GENERATOR v3 — variety + fair odds + headshots + game_winner
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

// Fair-odds guardrails — hard caps prevent hallucinated/extreme lines
const PIM_MIN = 10;
const PIM_MAX = 36;
const GOALS_MIN = 4.5;
const GOALS_MAX = 7.5;

function clampPimLine(raw: number): number {
  const r = Math.round(raw * 2) / 2;
  return Math.max(PIM_MIN, Math.min(PIM_MAX, r));
}

function clampGoalsLine(raw: number): number {
  const r = Math.round(raw * 2) / 2;
  return Math.max(GOALS_MIN, Math.min(GOALS_MAX, r));
}

async function fetchClubData(teamAbbrev: string): Promise<TeamClubData | null> {
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/club-stats-season/${teamAbbrev}/20252026`);
    if (!res.ok) return null;
    const data: any = await res.json();
    const skaters: Skater[] = data.skaters ?? [];
    const goalies: Goalie[] = data.goalies ?? [];
    const eligibleSkaters = skaters.filter((s) => s.positionCode !== "G");
    if (eligibleSkaters.length === 0) return null;
    // Debug: log top 3 skaters' points for visibility into what API returned
    const topThree = [...eligibleSkaters]
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 3)
      .map((s) => `${s.firstName?.default} ${s.lastName?.default}(${s.points ?? "?"}pts)`)
      .join(", ");
    console.log(`[${teamAbbrev}] top3: ${topThree} | teamPIM/GP: ${(totalPim / Math.max(maxGP, 1)).toFixed(2)}`);

    const totalPim = skaters.reduce((sum, s) => sum + (s.penaltyMinutes ?? s.pim ?? 0), 0);
    const maxGP = skaters.reduce((max, s) => Math.max(max, s.gamesPlayed ?? 0), 0);
    const teamPimPerGame = maxGP > 0 ? totalPim / maxGP : null;
    const totalGoals = skaters.reduce((sum, s) => sum + (s.goals ?? 0), 0);
    const teamGoalsPerGame = maxGP > 0 ? totalGoals / maxGP : null;

    return { abbrev: teamAbbrev, skaters: eligibleSkaters, goalies, teamPimPerGame, teamGoalsPerGame };
  } catch {
    return null;
  }
}

async function getPlayoffPimAverage(supabase: any, seriesId: string | null): Promise<number | null> {
  if (!seriesId) return null;
  const { data } = await supabase
    .from("games")
    .select("total_pim")
    .eq("series_id", seriesId)
    .eq("status", "final")
    .not("total_pim", "is", null);
  if (!data || data.length === 0) return null;
  const totals: number[] = data.map((g: any) => g.total_pim);
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

async function getLeaguePlayoffPimAverage(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("games")
    .select("total_pim")
    .eq("status", "final")
    .not("total_pim", "is", null);
  if (!data || data.length === 0) return 22;
  const totals: number[] = data.map((g: any) => g.total_pim);
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

function pickTopScorer(t: TeamClubData): Skater | null {
  // Must have actual points > 0 — defends against API returning no points field
  const sorted = [...t.skaters]
    .filter((s) => (s.points ?? 0) > 0)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  return sorted[0] ?? null;
}
function pickTopShooter(t: TeamClubData): Skater | null {
  return [...t.skaters].sort((a, b) => (b.shots ?? 0) - (a.shots ?? 0))[0] ?? null;
}
function pickTopPimLeader(t: TeamClubData): Skater | null {
  return [...t.skaters]
    .filter((s) => (s.gamesPlayed ?? 0) >= 10)
    .sort((a, b) => (b.penaltyMinutes ?? b.pim ?? 0) - (a.penaltyMinutes ?? a.pim ?? 0))[0] ?? null;
}
function pickStarterGoalie(t: TeamClubData): Goalie | null {
  return [...t.goalies]
    .filter((g) => (g.gamesPlayed ?? 0) >= 5)
    .sort((a, b) => (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0))[0] ?? null;
}
function headshotUrl(playerId: number): string {
  return `https://assets.nhle.com/mugs/nhl/20252026/${playerId}.png`;
}
function playerName(p: { firstName?: { default: string }; lastName?: { default: string } }): string {
  return `${p.firstName?.default ?? ""} ${p.lastName?.default ?? ""}`.trim();
}

type PropSpec =
  | { kind: "h2h_points"; a: Skater; b: Skater }
  | { kind: "h2h_shots"; a: Skater; b: Skater }
  | { kind: "h2h_pim"; a: Skater; b: Skater }
  | { kind: "h2h_saves"; a: Goalie; b: Goalie }
  | { kind: "total_pim"; line: number }
  | { kind: "total_goals"; line: number }
  | { kind: "game_winner" };

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chooseProps(
  homeTeam: TeamClubData,
  awayTeam: TeamClubData,
  pimLine: number,
  goalsLine: number,
): PropSpec[] {
  const picks: PropSpec[] = [];

  // ===== First prop: H2H variant =====
  const h2hOptions: PropSpec[] = [];
  const homeTop = pickTopScorer(homeTeam);
  const awayTop = pickTopScorer(awayTeam);
  if (homeTop && awayTop) h2hOptions.push({ kind: "h2h_points", a: awayTop, b: homeTop });

  const homeShooter = pickTopShooter(homeTeam);
  const awayShooter = pickTopShooter(awayTeam);
  if (
    homeShooter &&
    awayShooter &&
    (homeShooter.playerId !== homeTop?.playerId || awayShooter.playerId !== awayTop?.playerId)
  ) {
    h2hOptions.push({ kind: "h2h_shots", a: awayShooter, b: homeShooter });
  }

  const homeEnforcer = pickTopPimLeader(homeTeam);
  const awayEnforcer = pickTopPimLeader(awayTeam);
  if (
    homeEnforcer &&
    awayEnforcer &&
    (homeEnforcer.penaltyMinutes ?? 0) >= 40 &&
    (awayEnforcer.penaltyMinutes ?? 0) >= 40
  ) {
    h2hOptions.push({ kind: "h2h_pim", a: awayEnforcer, b: homeEnforcer });
  }

  const homeGoalie = pickStarterGoalie(homeTeam);
  const awayGoalie = pickStarterGoalie(awayTeam);
  if (homeGoalie && awayGoalie) {
    h2hOptions.push({ kind: "h2h_saves", a: awayGoalie, b: homeGoalie });
  }

  if (h2hOptions.length > 0) {
    const weighted: PropSpec[] = [];
    for (const opt of h2hOptions) {
      const count = opt.kind === "h2h_points" ? 3 : 1;
      for (let i = 0; i < count; i++) weighted.push(opt);
    }
    picks.push(pickRandom(weighted));
  }

  // ===== Second prop: totals or game winner =====
  // Weighted: PIM 40%, Goals 40%, Game Winner 20%
  const secondOptions: PropSpec[] = [
    { kind: "total_pim", line: pimLine },
    { kind: "total_pim", line: pimLine },
    { kind: "total_goals", line: goalsLine },
    { kind: "total_goals", line: goalsLine },
    { kind: "game_winner" },
  ];
  picks.push(pickRandom(secondOptions));

  return picks;
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
  const leaguePimAvg = await getLeaguePlayoffPimAverage(supabase);
  const leagueGoalsBaseline = 5.5;
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
    if (!homeData || !awayData) {
      results.push({ game: gameLabel, status: "skipped (club data fetch failed)" });
      continue;
    }

    // Simple, deterministic: combined regular-season PIM/GP. Clamped to fair range.
    const seasonPim = (homeData.teamPimPerGame ?? 0) + (awayData.teamPimPerGame ?? 0);
    const pimLine = clampPimLine(seasonPim > 0 ? seasonPim : leaguePimAvg);

    const seasonGoals = (homeData.teamGoalsPerGame ?? 0) + (awayData.teamGoalsPerGame ?? 0);
    const goalsRaw = seasonGoals > 0 ? 0.5 * seasonGoals + 0.5 * leagueGoalsBaseline : leagueGoalsBaseline;
    const goalsLine = clampGoalsLine(goalsRaw);

    const specs = chooseProps(homeData, awayData, pimLine, goalsLine);
    const propsToInsert: any[] = [];
    const descriptions: string[] = [];

    for (const spec of specs) {
      switch (spec.kind) {
        case "h2h_points":
        case "h2h_shots":
        case "h2h_pim": {
          const stat = spec.kind === "h2h_points" ? "points" : spec.kind === "h2h_shots" ? "shots" : "pim";
          propsToInsert.push({
            prop_type: "h2h_player",
            status: "open",
            points_reward: 5,
            game_id: gameId,
            locks_at: lockTime,
            metadata: {
              stat,
              game_label: gameLabel,
              player_a_name: playerName(spec.a),
              player_a_team: away,
              player_a_id: spec.a.playerId,
              player_a_headshot: headshotUrl(spec.a.playerId),
              player_b_name: playerName(spec.b),
              player_b_team: home,
              player_b_id: spec.b.playerId,
              player_b_headshot: headshotUrl(spec.b.playerId),
            },
          });
          descriptions.push(`H2H ${stat}: ${playerName(spec.a)} vs ${playerName(spec.b)}`);
          break;
        }
        case "h2h_saves": {
          propsToInsert.push({
            prop_type: "h2h_goalie",
            status: "open",
            points_reward: 5,
            game_id: gameId,
            locks_at: lockTime,
            metadata: {
              stat: "saves",
              game_label: gameLabel,
              player_a_name: playerName(spec.a),
              player_a_team: away,
              player_a_id: spec.a.playerId,
              player_a_headshot: headshotUrl(spec.a.playerId),
              player_b_name: playerName(spec.b),
              player_b_team: home,
              player_b_id: spec.b.playerId,
              player_b_headshot: headshotUrl(spec.b.playerId),
            },
          });
          descriptions.push(`Goalie duel: ${playerName(spec.a)} vs ${playerName(spec.b)}`);
          break;
        }
        case "total_pim": {
          propsToInsert.push({
            prop_type: "game_total_pim",
            status: "open",
            points_reward: 5,
            game_id: gameId,
            locks_at: lockTime,
            metadata: {
              line: String(spec.line),
              game_label: gameLabel,
              home_team: home,
              away_team: away,
            },
          });
          descriptions.push(`Total PIM O/U ${spec.line}`);
          break;
        }
        case "total_goals": {
          propsToInsert.push({
            prop_type: "game_total_goals",
            status: "open",
            points_reward: 5,
            game_id: gameId,
            locks_at: lockTime,
            metadata: {
              line: String(spec.line),
              game_label: gameLabel,
              home_team: home,
              away_team: away,
            },
          });
          descriptions.push(`Total Goals O/U ${spec.line}`);
          break;
        }
        case "game_winner": {
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
          break;
        }
      }
    }

    const { error: insertError } = await supabase.from("props").insert(propsToInsert);
    if (insertError) {
      results.push({ game: gameLabel, status: "error", error: insertError.message });
    } else {
      results.push({ game: gameLabel, gameId, status: "created", props: descriptions });
    }
  }

  return NextResponse.json({ ok: true, date: dateParam, results });
}
