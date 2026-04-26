"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { userActiveRides, flames, currentPickRound, type StreakPick, type StreakSeries } from "@/lib/bracketStreaks";

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
    () => userActiveRides(currentUserId, myPicks, series),
    [currentUserId, myPicks, series],
  );
  const hottest = rides[0] ?? null;
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

  const hottestTeam = hottest ? teamMap[hottest.team_id] : null;
  const hottestFlames = hottest ? flames(hottest.streak) : "";
  const hottestLabel = hottest && hottest.streak >= 2 ? "Riding" : hottest ? "Picked" : "";

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-brand">Your Position</div>
          <div className="mt-0.5 font-display text-[28px] font-black tabular-nums leading-none text-ink-100">{bankedPoints}<span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-500">pts banked</span></div>
        </div>
        {hottest && hottestTeam ? (
          <div className="flex items-center gap-2">
            {hottestTeam.logo_url && <img src={hottestTeam.logo_url} alt="" className="h-9 w-9 object-contain" />}
            <div className="text-right">
              <div className="font-display text-[14px] font-bold leading-tight text-ink-100">{hottestLabel} {hottestTeam.short_name}</div>
              <div className="font-mono text-[12px] leading-none text-amber-400">{hottestFlames || "—"}</div>
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">No active ride</div>
          </div>
        )}
      </div>

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