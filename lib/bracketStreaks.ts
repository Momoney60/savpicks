export type StreakSeries = {
  id: string;
  round: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  status?: "upcoming" | "live" | "completed";
  picks_lock_at?: string | null;
  wins_a?: number;
  wins_b?: number;
};

export type LiveTeamStatus = "leading" | "trailing" | "tied" | "won" | "eliminated" | "scheduled" | null;

export function liveTeamStatus(series: StreakSeries, teamId: string): LiveTeamStatus {
  if (!series.team_a_id || !series.team_b_id) return null;
  if (series.team_a_id !== teamId && series.team_b_id !== teamId) return null;
  if (series.winner_id) {
    return series.winner_id === teamId ? "won" : "eliminated";
  }
  if (series.status !== "live") return "scheduled";
  const winsA = series.wins_a ?? 0;
  const winsB = series.wins_b ?? 0;
  if (winsA === winsB) return "tied";
  const teamWins = series.team_a_id === teamId ? winsA : winsB;
  const oppWins = series.team_a_id === teamId ? winsB : winsA;
  return teamWins > oppWins ? "leading" : "trailing";
}

export function teamWithMostRidersInState(
  state: "leading" | "trailing",
  picks: StreakPick[],
  series: StreakSeries[],
): { team_id: string; series_id: string; round: number; team_wins: number; opp_wins: number; rider_count: number } | null {
  let best: { team_id: string; series_id: string; round: number; team_wins: number; opp_wins: number; rider_count: number } | null = null;
  for (const s of series) {
    if (s.status !== "live" || s.winner_id) continue;
    if (!s.team_a_id || !s.team_b_id) continue;
    for (const teamId of [s.team_a_id, s.team_b_id]) {
      if (liveTeamStatus(s, teamId) !== state) continue;
      const riderCount = ridersForCell(teamId, s.round, picks, series).length;
      if (riderCount === 0) continue;
      const isA = s.team_a_id === teamId;
      const teamWins = (isA ? s.wins_a : s.wins_b) ?? 0;
      const oppWins = (isA ? s.wins_b : s.wins_a) ?? 0;
      if (!best || riderCount > best.rider_count) {
        best = { team_id: teamId, series_id: s.id, round: s.round, team_wins: teamWins, opp_wins: oppWins, rider_count: riderCount };
      }
    }
  }
  return best;
}

export type RideWithLiveStatus = ActiveRide & { live_status: LiveTeamStatus; team_wins: number; opp_wins: number };

export function userActiveRidesWithStatus(
  userId: string,
  picks: StreakPick[],
  series: StreakSeries[],
): RideWithLiveStatus[] {
  const rides = userActiveRides(userId, picks, series);
  return rides.map((r) => {
    const s = series.find((x) => x.id === r.current_series_id);
    if (!s) return { ...r, live_status: null, team_wins: 0, opp_wins: 0 };
    const isA = s.team_a_id === r.team_id;
    return {
      ...r,
      live_status: liveTeamStatus(s, r.team_id),
      team_wins: (isA ? s.wins_a : s.wins_b) ?? 0,
      opp_wins: (isA ? s.wins_b : s.wins_a) ?? 0,
    };
  });
}

export type StreakPick = {
  user_id: string;
  series_id: string;
  picked_team_id: string;
};

const FLAME_CAP = 4;

export function streakDepth(
  userId: string,
  teamId: string,
  round: number,
  picks: StreakPick[],
  series: StreakSeries[],
): number {
  let streak = 0;
  for (let r = 1; r <= round; r++) {
    const s = series.find(
      (s) => s.round === r && (s.team_a_id === teamId || s.team_b_id === teamId),
    );
    if (!s) return 0;

    const pick = picks.find((p) => p.user_id === userId && p.series_id === s.id);
    if (!pick || pick.picked_team_id !== teamId) return 0;

    if (r < round) {
      if (s.winner_id !== teamId) return 0;
    } else {
      if (s.winner_id && s.winner_id !== teamId) return 0;
    }
    streak++;
  }
  return Math.min(streak, FLAME_CAP);
}

export function ridersForCell(
  teamId: string,
  round: number,
  picks: StreakPick[],
  series: StreakSeries[],
): { user_id: string; streak: number }[] {
  const userIds = Array.from(new Set(picks.map((p) => p.user_id)));
  const out: { user_id: string; streak: number }[] = [];
  for (const userId of userIds) {
    const s = streakDepth(userId, teamId, round, picks, series);
    if (s > 0) out.push({ user_id: userId, streak: s });
  }
  return out.sort((a, b) => b.streak - a.streak);
}

export function farthestPickRound(
  userId: string,
  teamId: string,
  picks: StreakPick[],
  series: StreakSeries[],
): number {
  const teamPicks = picks.filter(
    (p) => p.user_id === userId && p.picked_team_id === teamId,
  );
  let maxRound = 0;
  for (const pick of teamPicks) {
    const s = series.find((x) => x.id === pick.series_id);
    if (s && s.round > maxRound) maxRound = s.round;
  }
  return maxRound;
}

export function roundShortLabel(round: number): string {
  if (round === 1) return "R1";
  if (round === 2) return "R2";
  if (round === 3) return "Conf Final";
  if (round === 4) return "Cup";
  return `R${round}`;
}

export function multiplierFor(streak: number): number {
  if (streak < 1) return 1;
  return Math.pow(2, Math.min(streak, FLAME_CAP) - 1);
}

const BASE_POINTS = 10;

export function pointsForStreak(streak: number): number {
  if (streak < 1) return BASE_POINTS;
  return BASE_POINTS * multiplierFor(streak);
}

export function flames(streak: number): string {
  const n = Math.max(0, Math.min(streak, FLAME_CAP));
  return "🔥".repeat(n);
}

export type ActiveRide = {
  team_id: string;
  streak: number;
  current_round: number;
  current_series_id: string;
  current_series_status: "upcoming" | "live" | "completed";
  current_series_winner_id: string | null;
};

export function userActiveRides(
  userId: string,
  picks: StreakPick[],
  series: StreakSeries[],
): ActiveRide[] {
  const userPicks = picks.filter((p) => p.user_id === userId);
  const out: ActiveRide[] = [];
  for (const pick of userPicks) {
    const s = series.find((x) => x.id === pick.series_id);
    if (!s) continue;
    if (s.winner_id && s.winner_id !== pick.picked_team_id) continue;
    const streak = streakDepth(userId, pick.picked_team_id, s.round, picks, series);
    if (streak === 0) continue;
    out.push({
      team_id: pick.picked_team_id,
      streak,
      current_round: s.round,
      current_series_id: s.id,
      current_series_status: s.status ?? "upcoming",
      current_series_winner_id: s.winner_id ?? null,
    });
  }
  return out.sort((a, b) => b.streak - a.streak || b.current_round - a.current_round);
}

export type PickHistoryRow = {
  round: number;
  series_id: string;
  team_id: string;
  opponent_id: string | null;
  status: "upcoming" | "live" | "completed";
  outcome: "won" | "lost" | "pending";
  multiplier: number;
  awarded: number;
};

export function userPickHistory(
  userId: string,
  picks: StreakPick[],
  series: StreakSeries[],
  awardedByPick: Record<string, number> = {},
): PickHistoryRow[] {
  const out: PickHistoryRow[] = [];
  const userPicks = picks.filter((p) => p.user_id === userId);
  for (const pick of userPicks) {
    const s = series.find((x) => x.id === pick.series_id);
    if (!s) continue;
    const opponent =
      s.team_a_id === pick.picked_team_id ? s.team_b_id : s.team_a_id;
    const status = (s.status ?? "upcoming") as "upcoming" | "live" | "completed";
    let outcome: "won" | "lost" | "pending" = "pending";
    if (s.winner_id) outcome = s.winner_id === pick.picked_team_id ? "won" : "lost";
    const streak =
      outcome === "lost"
        ? 0
        : streakDepth(userId, pick.picked_team_id, s.round, picks, series);
    const multiplier = streak > 0 ? multiplierFor(streak) : 1;
    out.push({
      round: s.round,
      series_id: s.id,
      team_id: pick.picked_team_id,
      opponent_id: opponent,
      status,
      outcome,
      multiplier,
      awarded: awardedByPick[s.id] ?? 0,
    });
  }
  return out.sort((a, b) => a.round - b.round);
}

export function mostRiddenTeamForRound(
  round: number,
  picks: StreakPick[],
  series: StreakSeries[],
): { team_id: string; count: number } | null {
  const counts: Record<string, number> = {};
  const roundSeriesIds = new Set(
    series.filter((s) => s.round === round).map((s) => s.id),
  );
  for (const p of picks) {
    if (!roundSeriesIds.has(p.series_id)) continue;
    counts[p.picked_team_id] = (counts[p.picked_team_id] ?? 0) + 1;
  }
  let topId: string | null = null;
  let topCount = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (count > topCount) {
      topId = id;
      topCount = count;
    }
  }
  if (!topId) return null;
  return { team_id: topId, count: topCount };
}

export function usersOnStreakAtLeast(
  threshold: number,
  picks: StreakPick[],
  series: StreakSeries[],
): number {
  const userIds = Array.from(new Set(picks.map((p) => p.user_id)));
  let count = 0;
  for (const userId of userIds) {
    const rides = userActiveRides(userId, picks, series);
    const max = rides.reduce((m, r) => Math.max(m, r.streak), 0);
    if (max >= threshold) count++;
  }
  return count;
}

export function bracketBustsForRound(
  round: number,
  picks: StreakPick[],
  series: StreakSeries[],
): number {
  const roundSeries = series.filter((s) => s.round === round && s.winner_id);
  let count = 0;
  const userIds = Array.from(new Set(picks.map((p) => p.user_id)));
  for (const userId of userIds) {
    let busted = false;
    for (const s of roundSeries) {
      const pick = picks.find((p) => p.user_id === userId && p.series_id === s.id);
      if (pick && s.winner_id && pick.picked_team_id !== s.winner_id) {
        busted = true;
        break;
      }
    }
    if (busted) count++;
  }
  return count;
}

export function currentPickRound(series: StreakSeries[]): number | null {
  const now = Date.now();
  const rounds = series
    .filter((s) => {
      if (s.status !== "upcoming") return false;
      if (!s.picks_lock_at) return true;
      return new Date(s.picks_lock_at).getTime() > now;
    })
    .map((s) => s.round);
  if (rounds.length === 0) return null;
  return Math.min(...rounds);
}

export function priorRoundPickedTeam(
  userId: string,
  currentRound: number,
  picks: StreakPick[],
  series: StreakSeries[],
): string | null {
  if (currentRound <= 1) return null;
  const priorSeries = series.filter((s) => s.round === currentRound - 1);
  for (const s of priorSeries) {
    const pick = picks.find((p) => p.user_id === userId && p.series_id === s.id);
    if (pick && s.winner_id === pick.picked_team_id) {
      return pick.picked_team_id;
    }
  }
  return null;
}