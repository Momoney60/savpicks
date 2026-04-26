"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  userPickHistory,
  pointsForStreak,
  flames,
  roundShortLabel,
  streakDepth,
  type StreakPick,
  type StreakSeries,
} from "@/lib/bracketStreaks";

type Team = { id: string; short_name: string; logo_url: string | null };

type AwardedRow = { series_id: string; awarded_points: number };

export default function YourJourneyCard({
  currentUserId,
  myPicks,
  series,
  teams,
  awarded,
}: {
  currentUserId: string;
  myPicks: StreakPick[];
  series: StreakSeries[];
  teams: Team[];
  awarded: AwardedRow[];
}) {
  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  const awardedMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of awarded) m[a.series_id] = a.awarded_points ?? 0;
    return m;
  }, [awarded]);

  const history = useMemo(
    () => userPickHistory(currentUserId, myPicks, series, awardedMap),
    [currentUserId, myPicks, series, awardedMap],
  );

  const byRound: Record<number, typeof history> = { 1: [], 2: [], 3: [], 4: [] };
  for (const row of history) {
    if (byRound[row.round]) byRound[row.round].push(row);
  }

  const priorPickedByRound: Record<number, string | undefined> = {};
  for (const row of history) {
    priorPickedByRound[row.round] = row.team_id;
  }

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-4 shadow-card">
      <div className="mb-3 font-mono text-[9px] font-black uppercase tracking-[0.25em] text-brand">Your Journey</div>
      <div className="space-y-1">
        {[1, 2, 3, 4].map((r) => {
          const rows = byRound[r] ?? [];
          if (rows.length === 0) {
            return (
              <div key={r} className="flex items-center justify-between rounded-md bg-ink-900/40 px-3 py-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-500">{roundShortLabel(r)}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-700">—</span>
              </div>
            );
          }
          return (
            <div key={r} className="rounded-md bg-ink-900/40 px-3 py-2">
              <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400">{roundShortLabel(r)}</div>
              <div className="space-y-1">
                {rows.map((row) => {
                  const team = teamMap[row.team_id];
                  const prior = priorPickedByRound[r - 1];
                  const action = r === 1 ? "picked" : prior === row.team_id ? "rode" : "switched to";
                  const liveStreak = streakDepth(currentUserId, row.team_id, row.round, myPicks, series);
                  const flameStack = row.outcome === "lost" ? "" : flames(liveStreak);
                  const wonPoints = row.awarded || pointsForStreak(liveStreak);
                  const outcomeBadge =
                    row.outcome === "won" ? (
                      <span className="rounded-md bg-brand/15 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-brand">+{wonPoints}</span>
                    ) : row.outcome === "lost" ? (
                      <span className="rounded-md bg-rink-red/20 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-rink-red">BUST</span>
                    ) : (
                      <span className="rounded-md bg-ink-700 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-ink-300">PENDING</span>
                    );
                  return (
                    <div key={row.series_id} className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {team?.logo_url && <img src={team.logo_url} alt="" className="h-4 w-4 flex-none object-contain" />}
                        <span className="truncate font-display text-[12px] text-ink-200">{action} <span className={cn("font-bold", row.outcome === "lost" ? "text-ink-500 line-through" : "text-ink-100")}>{team?.short_name ?? row.team_id}</span></span>
                        {flameStack && <span className="font-mono text-[11px] leading-none text-amber-400">{flameStack}</span>}
                      </div>
                      {outcomeBadge}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}