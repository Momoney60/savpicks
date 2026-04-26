"use client";

import { useMemo } from "react";
import {
  mostRiddenTeamForRound,
  bracketBustsForRound,
  currentPickRound,
  teamWithMostRidersInState,
  type StreakPick,
  type StreakSeries,
} from "@/lib/bracketStreaks";

type Team = { id: string; short_name: string; logo_url: string | null };

export default function LeaguePulseCard({
  series,
  allBracketPicks,
  teams,
}: {
  series: StreakSeries[];
  allBracketPicks: StreakPick[];
  teams: Team[];
}) {
  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  const pickRound = useMemo(() => currentPickRound(series), [series]);

  const hottest = useMemo(() => {
    const r = pickRound ?? Math.max(...series.map((s) => s.round), 1);
    return mostRiddenTeamForRound(r, allBracketPicks, series);
  }, [pickRound, series, allBracketPicks]);

  const lastCompletedRound = useMemo(() => {
    const rounds = series.filter((s) => s.winner_id).map((s) => s.round);
    if (rounds.length === 0) return null;
    return Math.max(...rounds);
  }, [series]);

  const busts = useMemo(
    () => (lastCompletedRound == null ? 0 : bracketBustsForRound(lastCompletedRound, allBracketPicks, series)),
    [lastCompletedRound, allBracketPicks, series],
  );

  const hottestTeam = hottest ? teamMap[hottest.team_id] : null;

  const trending = useMemo(() => teamWithMostRidersInState("leading", allBracketPicks, series), [allBracketPicks, series]);
  const inDanger = useMemo(() => teamWithMostRidersInState("trailing", allBracketPicks, series), [allBracketPicks, series]);
  const trendingTeam = trending ? teamMap[trending.team_id] : null;
  const dangerTeam = inDanger ? teamMap[inDanger.team_id] : null;

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-4 shadow-card">
      <div className="mb-3 font-mono text-[9px] font-black uppercase tracking-[0.25em] text-brand">League Pulse</div>
      <div className="space-y-1.5">
        {hottestTeam && (
          <PulseRow
            icon={hottestTeam.logo_url ? <img src={hottestTeam.logo_url} alt="" className="h-7 w-7 object-contain" /> : <span className="text-[16px]">🏒</span>}
            label={`Hottest team: ${hottestTeam.short_name} (${hottest!.count} ${hottest!.count === 1 ? "rider" : "riders"})`}
          />
        )}
        {trendingTeam && trending && (
          <PulseRow
            icon={trendingTeam.logo_url ? <img src={trendingTeam.logo_url} alt="" className="h-7 w-7 object-contain" /> : <span className="text-[16px]">▲</span>}
            label={`Trending: ${trendingTeam.short_name} leads ${trending.team_wins}-${trending.opp_wins} · ${trending.rider_count} cruising`}
          />
        )}
        {dangerTeam && inDanger && (
          <PulseRow
            icon={dangerTeam.logo_url ? <img src={dangerTeam.logo_url} alt="" className="h-7 w-7 object-contain opacity-80" /> : <span className="text-[16px]">▼</span>}
            label={`In danger: ${dangerTeam.short_name} trails ${inDanger.team_wins}-${inDanger.opp_wins} · ${inDanger.rider_count} sweating`}
          />
        )}
        {lastCompletedRound != null && busts > 0 && (
          <PulseRow icon={<span className="text-[16px] leading-none">💀</span>} label={`${busts} ${busts === 1 ? "pick" : "picks"} missed R${lastCompletedRound}`} />
        )}
      </div>
    </div>
  );
}

function PulseRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-ink-900/40 px-3 py-2">
      <div className="flex h-7 w-7 flex-none items-center justify-center leading-none">{icon}</div>
      <span className="font-display text-[12px] text-ink-200">{label}</span>
    </div>
  );
}