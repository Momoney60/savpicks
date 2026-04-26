export type StreakSeries = {
  id: string;
  round: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
};

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