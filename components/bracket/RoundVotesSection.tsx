"use client";

import { useMemo } from "react";
import SeriesVoteBar, { type VoteSeries } from "./SeriesVoteBar";
import type { StreakPick } from "@/lib/bracketStreaks";

// "Pool picks" view — shows vote split bars for each in-play series.
// Lives below the bracket on /app/bracket so users can scan how the
// field split on the current games without opening every team's drawer.
export default function RoundVotesSection({
  series,
  picks,
  currentUserId,
}: {
  series: VoteSeries[];
  picks: StreakPick[];
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

  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-brand">Pool Picks</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
          {visible[0].status === "live" ? "Live now" : `R${visible[0].round} recap`}
        </span>
      </div>
      <div className="space-y-2">
        {visible.map((s) => (
          <SeriesVoteBar key={s.id} series={s} picks={picks} currentUserId={currentUserId} />
        ))}
      </div>
    </div>
  );
}