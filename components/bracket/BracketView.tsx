"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, haptic, bracketMultiplier } from "@/lib/utils";

type Team = {
  id: string;
  full_name: string;
  short_name: string;
  primary_color: string | null;
  logo_url: string | null;
  is_eliminated: boolean;
};

type Series = {
  id: string;
  round: number;
  conference: string | null;
  bracket_slot: string;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_seed: number | null;
  team_b_seed: number | null;
  winner_id: string | null;
  wins_a: number;
  wins_b: number;
  status: "upcoming" | "live" | "completed";
  picks_lock_at: string | null;
  team_a?: Team | null;
  team_b?: Team | null;
  winner?: Team | null;
};

type Pick = {
  id: string;
  series_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
  streak_length: number | null;
  awarded_points: number;
};

export default function BracketView({ series, myPicks }: { series: Series[]; myPicks: Pick[]; teams: Team[]; }) {
  const [round, setRound] = useState(1);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set(myPicks.map(p => p.series_id)));
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const pickByTeamByRound = useMemo(() => {
    const map: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
    myPicks.forEach((p) => {
      const s = series.find((s) => s.id === p.series_id);
      if (s) map[s.round].add(p.picked_team_id);
    });
    return map;
  }, [series, myPicks]);

  const roundSeries = series.filter((s) => s.round === round);

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
      setConfirmed((prev) => new Set(prev).add(seriesId));
      setToast({ msg: "Pick saved ✓", ok: true });
      setTimeout(() => setToast(null), 1500);
    } catch (e: any) {
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

  function getPreviewStreak(teamId: string, currentRound: number) {
    let streak = 1;
    for (let r = currentRound - 1; r >= 1; r--) {
      if (pickByTeamByRound[r]?.has(teamId)) streak++; else break;
    }
    return streak;
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
              "fixed left-1/2 top-safe z-[70] -translate-x-1/2 mt-3 rounded-xl border px-4 py-2.5 font-semibold shadow-lg backdrop-blur-xl text-[13px]",
              toast.ok
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-loss/40 bg-loss/10 text-loss"
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-5 flex rounded-xl border border-ink-700 bg-ink-850 p-1">
        {[1, 2, 3, 4].map((r) => {
          const labels = { 1: "R1", 2: "R2", 3: "CF", 4: "CUP" };
          return (
            <button
              key={r}
              onClick={() => { haptic("light"); setRound(r); }}
              className={cn("flex-1 rounded-lg py-2 text-[12px] font-bold tracking-wider transition", round === r ? "bg-brand text-ink-900" : "text-ink-400")}
            >
              {labels[r as keyof typeof labels]}
            </button>
          );
        })}
      </div>

      {roundSeries.length === 0 ? (
        <div className="rounded-2xl border border-ink-700 bg-ink-850 p-8 text-center">
          <div className="text-5xl">🏗️</div>
          <p className="mt-4 font-display text-lg font-bold">Round {round} not set yet</p>
          <p className="mt-1 text-sm text-ink-400">The commissioner will load matchups once the previous round resolves.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roundSeries.map((s) => {
            const existingPick = myPicks.find((p) => p.series_id === s.id);
            const optimisticPick = optimistic[s.id];
            const currentPick = optimisticPick ?? existingPick?.picked_team_id;
            return (
              <SeriesCard
                key={s.id}
                series={s}
                currentPick={currentPick ?? null}
                existingPick={existingPick ?? null}
                getPreviewStreak={getPreviewStreak}
                onPick={(teamId) => placePick(s.id, teamId)}
                saveState={confirmed.has(s.id) ? "saved" : optimistic[s.id] ? "saving" : "idle"}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function SeriesCard({ series, currentPick, existingPick, getPreviewStreak, onPick, saveState }: {
  series: Series;
  currentPick: string | null;
  existingPick: Pick | null;
  getPreviewStreak: (teamId: string, round: number) => number;
  onPick: (teamId: string) => void;
  saveState: "idle" | "saving" | "saved";
}) {
  const locked = series.status !== "upcoming" || (series.picks_lock_at && new Date(series.picks_lock_at) < new Date());
  const teamA = series.team_a;
  const teamB = series.team_b;

  if (!teamA || !teamB) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5 opacity-50">
        <div className="text-xs text-ink-400">{series.conference ?? "Cup Final"} · TBD</div>
        <div className="mt-2 font-display text-base text-ink-300">Matchup pending prior round</div>
      </div>
    );
  }

  return (
    <motion.div layout className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 shadow-card">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">
          {series.conference ?? "Stanley Cup Final"} · Slot {series.bracket_slot}
        </span>
        {series.status === "live" && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-live">
            <span className="h-1.5 w-1.5 rounded-full bg-live live-dot" />LIVE
          </span>
        )}
        {series.status === "completed" && series.winner && (
          <span className="text-[10px] font-bold text-brand">✓ {series.winner.short_name}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-ink-700">
        {[teamA, teamB].map((team) => {
          const picked = currentPick === team.id;
          const isWinner = series.winner_id === team.id;
          const isLoser = series.winner_id && series.winner_id !== team.id;
          const streak = getPreviewStreak(team.id, series.round);
          const multiplier = bracketMultiplier(streak);

          return (
            <button
              key={team.id}
              onClick={() => !locked && onPick(team.id)}
              disabled={!!locked}
              className={cn(
                "relative flex flex-col items-start gap-2 bg-ink-850 px-4 py-4 text-left transition",
                picked && !locked && "bg-brand/10 ring-1 ring-inset ring-brand",
                isWinner && "bg-brand/15",
                isLoser && "opacity-40 grayscale",
                !locked && !picked && "active:bg-ink-800",
                locked && "cursor-not-allowed"
              )}
              style={picked && !locked && team.primary_color ? { boxShadow: `inset 4px 0 0 0 ${team.primary_color}` } : undefined}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-[10px] font-bold text-ink-500">
                  #{series.team_a_id === team.id ? series.team_a_seed ?? "?" : series.team_b_seed ?? "?"}
                </span>
                {multiplier > 1 && !locked && (
                  <span className="rounded-md bg-brand/20 px-1.5 py-0.5 text-[10px] font-black text-brand">{multiplier}×</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {team.logo_url && (
                  <img src={team.logo_url} alt="" className="h-8 w-8 object-contain" />
                )}
                <div className="font-display text-[15px] font-bold leading-tight text-ink-100">
                  {team.short_name}
                </div>
              </div>
              <div className="text-[11px] text-ink-400">
                {series.team_a_id === team.id ? series.wins_a : series.wins_b} wins
              </div>
              {picked && !locked && (
                <span className={cn(
                  "absolute top-2 right-2 text-[10px] font-bold",
                  saveState === "saved" ? "text-brand" : saveState === "saving" ? "text-pending" : "text-brand"
                )}>
                  {saveState === "saving" ? "SAVING…" : "✓ YOUR PICK"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {existingPick?.awarded_points ? (
        <div className="border-t border-ink-700 bg-brand/5 px-4 py-2.5 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            +{existingPick.awarded_points} pts{existingPick.streak_length && existingPick.streak_length > 1 && (<span className="ml-1">· {existingPick.streak_length}× streak</span>)}
          </span>
        </div>
      ) : series.picks_lock_at ? (
        <div className="border-t border-ink-700 px-4 py-2.5 text-center">
          <span className="text-[11px] text-ink-500">
            {locked ? "🔒 Picks locked" : `Locks ${new Date(series.picks_lock_at).toLocaleString()}`}
          </span>
        </div>
      ) : null}
    </motion.div>
  );
}
