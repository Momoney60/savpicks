"use client";

import { useMemo } from "react";
import SeriesVoteBar, { type VoteSeries } from "./SeriesVoteBar";
import type { StreakPick, StreakSeries } from "@/lib/bracketStreaks";

type Profile = { user_id: string; gamertag: string };

export default function RoundVotesSection({
  series,
  picks,
  profiles,
  currentUserId,
}: {
  series: VoteSeries[];
  picks: StreakPick[];
  profiles?: Profile[];
  currentUserId?: string;
}) {
  const visible = useMemo(() => {
    const live = series.filter((s) => s.status === "live");
    if (live.length > 0) return live;

    const completed = series.filter((s) => s.status === "completed" && s.winner_id);
    if (completed.length === 0) return [];
    const maxRound = Math.max(...completed.map((s) => s.round));
    return completed.filter((s) => s.round === maxRound);
  }, [series]);

  // Pass the full series list (as StreakSeries) so vote bars can chain-walk for flame counts
  const allStreakSeries: StreakSeries[] = useMemo(
    () =>
      series.map((s) => ({
        id: s.id,
        round: s.round,
        team_a_id: s.team_a_id,
        team_b_id: s.team_b_id,
        winner_id: s.winner_id,
        status: s.status,
        wins_a: s.wins_a,
        wins_b: s.wins_b,
        picks_lock_at: s.picks_lock_at,
      })),
    [series],
  );

  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-brand">Pool Picks</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
          {visible[0].status === "live" ? "Live now · tap to expand" : `R${visible[0].round} recap · tap to expand`}
        </span>
      </div>
      <div className="space-y-2">
        {visible.map((s) => (
          <SeriesVoteBar
            key={s.id}
            series={s}
            picks={picks}
            allSeries={allStreakSeries}
            profiles={profiles}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}