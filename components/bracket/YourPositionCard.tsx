"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { userActiveRidesWithStatus, flames, currentPickRound, type StreakPick, type StreakSeries, type LiveTeamStatus } from "@/lib/bracketStreaks";

type Team = { id: string; short_name: string; logo_url: string | null };

export default function YourPositionCard({
  currentUserId,
  myPicks,
  series,
  teams,
  bankedPoints,
}: {
  currentUserId: string;
  myPicks: StreakPick[];
  series: (StreakSeries & { picks_lock_at?: string | null })[];
  teams: Team[];
  bankedPoints: number;
}) {
  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  const rides = useMemo(
    () => userActiveRidesWithStatus(currentUserId, myPicks, series),
    [currentUserId, myPicks, series],
  );

  // Tonight = rides whose current series is live or upcoming (not completed)
  const tonight = useMemo(
    () => rides.filter((r) => r.live_status === "leading" || r.live_status === "trailing" || r.live_status === "tied" || r.live_status === "scheduled"),
    [rides],
  );

  const pickRound = useMemo(() => currentPickRound(series), [series]);

  const pendingThisRound = useMemo(() => {
    if (pickRound == null) return { count: 0, nextLockAt: null as string | null };
    const roundSeries = series.filter((s) => s.round === pickRound && s.status === "upcoming");
    let count = 0;
    let nextLock: number | null = null;
    for (const s of roundSeries) {
      const mine = myPicks.find((p) => p.user_id === currentUserId && p.series_id === s.id);
      if (!mine) {
        count++;
        if (s.picks_lock_at) {
          const t = new Date(s.picks_lock_at).getTime();
          if (nextLock === null || t < nextLock) nextLock = t;
        }
      }
    }
    return { count, nextLockAt: nextLock != null ? new Date(nextLock).toISOString() : null };
  }, [pickRound, series, myPicks, currentUserId]);

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-brand">Your Position</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{rides.length} active {rides.length === 1 ? "ride" : "rides"}</div>
      </div>
      <div className="mt-0.5 font-display text-[28px] font-black tabular-nums leading-none text-ink-100">{bankedPoints}<span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-500">pts banked</span></div>

      {tonight.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="font-mono text-[9px] font-black uppercase tracking-wider text-ink-400">Tonight</div>
          {tonight.map((r) => {
            const t = teamMap[r.team_id];
            return <RideRow key={r.current_series_id} team={t} streak={r.streak} status={r.live_status} teamWins={r.team_wins} oppWins={r.opp_wins} />;
          })}
        </div>
      )}

      {pendingThisRound.count > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-ink-700/40 pt-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-300">
            {pendingThisRound.count} pick{pendingThisRound.count === 1 ? "" : "s"} pending
          </span>
          {pendingThisRound.nextLockAt && (
            <Countdown target={pendingThisRound.nextLockAt} />
          )}
        </div>
      )}
    </div>
  );
}

function RideRow({ team, streak, status, teamWins, oppWins }: { team: Team | undefined; streak: number; status: LiveTeamStatus; teamWins: number; oppWins: number }) {
  const stateLabel =
    status === "leading" ? `leads ${teamWins}-${oppWins}` :
    status === "trailing" ? `trails ${teamWins}-${oppWins}` :
    status === "tied" ? `tied ${teamWins}-${oppWins}` :
    status === "scheduled" ? "tonight" :
    `${teamWins}-${oppWins}`;
  const tone =
    status === "leading" ? "border-brand/30 bg-brand/[0.04]" :
    status === "trailing" ? "border-rink-red/30 bg-rink-red/[0.04]" :
    "border-ink-700 bg-ink-900/40";
  const stateColor =
    status === "leading" ? "text-brand" :
    status === "trailing" ? "text-rink-red" :
    "text-ink-400";
  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2", tone)}>
      {team?.logo_url && <img src={team.logo_url} alt="" className="h-5 w-5 flex-none object-contain" />}
      <div className="min-w-0 flex-1">
        <span className="font-display text-[12px] font-bold text-ink-100">{team?.short_name ?? "?"}</span>
        <span className={cn("ml-1.5 font-mono text-[10px] uppercase tracking-wider", stateColor)}>{stateLabel}</span>
      </div>
      {streak > 0 && <span className="font-mono text-[11px] leading-none text-amber-400">{flames(streak)}</span>}
    </div>
  );
}

function Countdown({ target }: { target: string }) {
  const diff = new Date(target).getTime() - Date.now();
  let label = "LOCKED";
  if (diff > 0) {
    const hrs = Math.floor(diff / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    label = hrs > 0 ? `LOCKS IN ${hrs}H ${mins}M` : `LOCKS IN ${mins}M`;
  }
  return <span className="font-mono text-[10px] font-black uppercase tracking-wider text-brand">{label}</span>;
}