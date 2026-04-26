"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, haptic } from "@/lib/utils";
import {
  streakDepth,
  multiplierFor,
  roundShortLabel,
  type StreakPick,
  type StreakSeries,
} from "@/lib/bracketStreaks";

type Team = { id: string; short_name: string; logo_url: string | null; primary_color: string | null };
type Series = StreakSeries & {
  picks_lock_at?: string | null;
  team_a?: Team | null;
  team_b?: Team | null;
};

type Toast = { msg: string; ok: boolean } | null;

export default function ThisRoundDecision({
  currentUserId,
  pickRound,
  series,
  myPicks,
  allBracketPicks,
}: {
  currentUserId: string;
  pickRound: number | null;
  series: Series[];
  myPicks: StreakPick[];
  allBracketPicks: StreakPick[];
}) {
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast>(null);

  const roundSeries = useMemo(
    () => (pickRound == null ? [] : series.filter((s) => s.round === pickRound).sort((a, b) => (a.id > b.id ? 1 : -1))),
    [pickRound, series],
  );

  if (pickRound == null || roundSeries.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-5 text-center shadow-card">
        <div className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-brand">No Picks Open</div>
        <p className="mt-2 text-[12px] text-ink-400">All current picks are locked. Come back when the next round opens.</p>
      </div>
    );
  }

  async function placePick(seriesId: string, teamId: string) {
    haptic("medium");
    setOptimistic((prev) => ({ ...prev, [seriesId]: teamId }));
    try {
      const res = await fetch("/api/picks/bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series_id: seriesId, picked_team_id: teamId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        haptic("heavy");
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[seriesId];
          return next;
        });
        setToast({ msg: data?.error ?? `Failed (${res.status})`, ok: false });
        setTimeout(() => setToast(null), 4000);
        return;
      }
      setToast({ msg: "Pick saved ✓", ok: true });
      setTimeout(() => setToast(null), 1500);
    } catch {
      haptic("heavy");
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[seriesId];
        return next;
      });
      setToast({ msg: "Network error — try again", ok: false });
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed left-1/2 top-safe z-[70] mt-3 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold shadow-lg backdrop-blur-xl",
              toast.ok ? "border-brand/40 bg-brand/10 text-brand" : "border-loss/40 bg-loss/10 text-loss",
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-brand">This Round&apos;s Decision</span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{roundShortLabel(pickRound)}</span>
        </div>

        {roundSeries.map((s) => {
          const my = myPicks.find((p) => p.user_id === currentUserId && p.series_id === s.id);
          const optPick = optimistic[s.id];
          const currentPick = optPick ?? my?.picked_team_id ?? null;
          return (
            <SeriesPickCard
              key={s.id}
              series={s}
              currentUserId={currentUserId}
              currentPick={currentPick}
              picks={allBracketPicks}
              allSeries={series}
              onPick={(tid) => placePick(s.id, tid)}
            />
          );
        })}
      </div>
    </>
  );
}

function SeriesPickCard({
  series,
  currentUserId,
  currentPick,
  picks,
  allSeries,
  onPick,
}: {
  series: Series;
  currentUserId: string;
  currentPick: string | null;
  picks: StreakPick[];
  allSeries: StreakSeries[];
  onPick: (teamId: string) => void;
}) {
  const teamA = series.team_a;
  const teamB = series.team_b;
  const lockedByTime = !!series.picks_lock_at && new Date(series.picks_lock_at) <= new Date();
  const locked = series.status !== "upcoming" || lockedByTime;

  if (!teamA || !teamB) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-5 text-center opacity-60">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">Matchup pending prior round</div>
      </div>
    );
  }

  const ridersFor = (tid: string) => picks.filter((p) => p.series_id === series.id && p.picked_team_id === tid).length;

  return (
    <motion.div layout className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 shadow-card">
      <div className="grid grid-cols-2 gap-px bg-ink-700">
        <TeamButton
          team={teamA}
          opponent={teamB}
          series={series}
          currentUserId={currentUserId}
          picks={picks}
          allSeries={allSeries}
          picked={currentPick === teamA.id}
          locked={locked}
          riders={ridersFor(teamA.id)}
          onPick={() => onPick(teamA.id)}
        />
        <TeamButton
          team={teamB}
          opponent={teamA}
          series={series}
          currentUserId={currentUserId}
          picks={picks}
          allSeries={allSeries}
          picked={currentPick === teamB.id}
          locked={locked}
          riders={ridersFor(teamB.id)}
          onPick={() => onPick(teamB.id)}
        />
      </div>

      {series.picks_lock_at && (
        <div className="border-t border-ink-700 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-ink-500">
          {locked ? "🔒 Picks locked" : `Locks ${new Date(series.picks_lock_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`}
        </div>
      )}
    </motion.div>
  );
}

function TeamButton({
  team,
  opponent,
  series,
  currentUserId,
  picks,
  allSeries,
  picked,
  locked,
  riders,
  onPick,
}: {
  team: Team;
  opponent: Team;
  series: Series;
  currentUserId: string;
  picks: StreakPick[];
  allSeries: StreakSeries[];
  picked: boolean;
  locked: boolean;
  riders: number;
  onPick: () => void;
}) {
  const priorChain = series.round > 1 ? streakDepth(currentUserId, team.id, series.round - 1, picks, allSeries) : 0;
  const opponentPriorChain = series.round > 1 ? streakDepth(currentUserId, opponent.id, series.round - 1, picks, allSeries) : 0;

  const isRide = priorChain >= 1;
  const isSwitch = !isRide && opponentPriorChain >= 1;
  const lockMultiplier = isRide ? multiplierFor(priorChain + 1) : 1;
  const subLabel = isRide ? `Lock ${lockMultiplier}×` : isSwitch ? "Reset to 1×" : "+5 pts";

  return (
    <button
      type="button"
      onClick={() => !locked && onPick()}
      disabled={locked}
      className={cn(
        "relative flex flex-col items-start gap-2 bg-ink-850 px-3.5 py-3.5 text-left transition",
        picked && !locked && "bg-brand/10 ring-1 ring-inset ring-brand",
        !locked && !picked && "active:bg-ink-800",
        locked && "cursor-not-allowed opacity-80",
      )}
      style={picked && !locked && team.primary_color ? { boxShadow: `inset 4px 0 0 0 ${team.primary_color}` } : undefined}
    >
      <div className="flex w-full items-center justify-between">
        <span className={cn("font-mono text-[9px] font-black uppercase tracking-wider", isRide ? "text-amber-400" : isSwitch ? "text-ink-400" : "text-ink-500")}>
          {isRide ? `${priorChain}🔥 RIDE` : isSwitch ? "SWITCH" : "PICK"}
        </span>
        {picked && (
          <span className="font-mono text-[9px] font-black uppercase text-brand">✓ MINE</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {team.logo_url && <img src={team.logo_url} alt="" className="h-9 w-9 object-contain" />}
        <div className="min-w-0">
          <div className="truncate font-display text-[14px] font-bold leading-tight text-ink-100">{team.short_name}</div>
          <div className={cn("font-mono text-[10px] uppercase tracking-wider", isRide ? "text-amber-400" : "text-ink-500")}>{subLabel}</div>
        </div>
      </div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
        {riders} {riders === 1 ? "rider" : "riders"}
      </div>
    </button>
  );
}