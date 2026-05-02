"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, haptic, formatPoints } from "@/lib/utils";

type Row = { user_id: string; gamertag: string; points: number; hits?: number; max_streak?: number; rank: number; yesterday_points?: number; hit_rate?: number | null };

export default function LeaderboardSwitcher({
  bracket,
  propsR1,
  propsR2,
  r1Done,
  currentUserId,
}: {
  bracket: Row[];
  propsR1: Row[];
  propsR2?: Row[] | null;
  r1Done?: boolean;
  currentUserId: string;
}) {
  const [mode, setMode] = useState<"bracket" | "props">("bracket");
  const r2HasData = !!propsR2 && propsR2.length > 0;
  const [propsRound, setPropsRound] = useState<1 | 2>(r2HasData ? 2 : 1);

  const propsRows = propsRound === 1 ? propsR1 : (propsR2 ?? []);
  const rows = mode === "bracket" ? bracket : propsRows;
  const subtitle = mode === "bracket" ? "Main pot" : "$100 per round";
  const leaderPoints = rows[0]?.points ?? 0;
  const showR1WinnerBadge = mode === "props" && propsRound === 1 && !!r1Done && propsRows[0]?.points > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-gradient-to-b from-ink-850 to-ink-900">
      <div className="flex items-center justify-between border-b border-ink-700/50 bg-ink-900/80 px-3 py-2">
        <div className="flex rounded-md bg-ink-800 p-0.5">
          {(["bracket", "props"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { haptic("light"); setMode(m); }}
              className={cn(
                "rounded px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.15em] transition",
                mode === m ? "bg-brand text-ink-900 shadow-sm shadow-brand/30" : "text-ink-400"
              )}
            >
              {m === "bracket" ? "Bracket" : "Props"}
            </button>
          ))}
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{subtitle}</span>
      </div>

      {mode === "props" && r2HasData && (
        <div className="flex items-center justify-between border-b border-ink-700/40 bg-ink-900/40 px-3 py-1.5">
          <div className="flex rounded-md bg-ink-800 p-0.5">
            {([1, 2] as const).map((r) => (
              <button
                key={r}
                onClick={() => { haptic("light"); setPropsRound(r); }}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider transition",
                  propsRound === r ? "bg-brand text-ink-900" : "text-ink-400"
                )}
              >
                R{r}
                {r === 1 && r1Done && <span className="text-[10px] leading-none">🏆</span>}
              </button>
            ))}
          </div>
          {propsRound === 1 && r1Done && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-yellow-400">Round complete</span>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={mode + "-" + propsRound}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center"><p className="text-[12px] text-ink-400">No points yet.</p></div>
          ) : (
            rows.map((row, i) => {
              const isMe = row.user_id === currentUserId;
              const back = leaderPoints - row.points;
              const isR1Champ = showR1WinnerBadge && row.rank === 1;
              const rankBg =
                isR1Champ ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-ink-900 shadow-md shadow-yellow-500/40 ring-1 ring-yellow-300"
                : row.rank === 1 && leaderPoints > 0 ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-ink-900 shadow-md shadow-yellow-500/30"
                : row.rank === 2 && leaderPoints > 0 ? "bg-gradient-to-br from-slate-200 to-slate-400 text-ink-900"
                : row.rank === 3 && leaderPoints > 0 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-ink-100"
                : "bg-ink-800 text-ink-400";
              return (
                <div
                  key={row.user_id}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2",
                    i < rows.length - 1 && "border-b border-ink-700/30",
                    isMe && "bg-brand/[0.04]",
                    isR1Champ && "bg-gradient-to-r from-yellow-500/[0.10] to-transparent",
                    !isR1Champ && row.rank === 1 && leaderPoints > 0 && "bg-gradient-to-r from-yellow-500/[0.05] to-transparent"
                  )}
                >
                  {(isR1Champ || (row.rank === 1 && leaderPoints > 0)) && <div className="absolute left-0 top-0 h-full w-0.5 bg-gradient-to-b from-yellow-300 to-yellow-600" />}
                  <div className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-md font-display text-[12px] font-black tabular-nums", rankBg)}>
                    {row.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("truncate font-display text-[13px] font-bold", isMe ? "text-brand" : "text-ink-100")}>
                        {row.gamertag}
                      </span>
                      {isMe && <span className="rounded-sm bg-brand/15 px-1 font-mono text-[8px] font-black uppercase tracking-wider text-brand">you</span>}
                      {isR1Champ && <span className="rounded-sm bg-yellow-400/20 px-1 font-mono text-[8px] font-black uppercase tracking-wider text-yellow-400">R1 winner</span>}
                      {row.max_streak !== undefined && row.max_streak >= 2 && (
                        <span className="font-mono text-[10px] font-bold text-orange-400">{row.max_streak}x</span>
                      )}
                    </div>
                    {back > 0 && (
                      <div className="font-mono text-[9px] text-ink-500">-{back} from leader</div>
                    )}
                    {row.rank === 1 && rows.length > 1 && leaderPoints > 0 && !isR1Champ && (
                      <div className="font-mono text-[9px] font-bold text-yellow-400">leading</div>
                    )}
                    {mode === "props" && (row.yesterday_points ?? 0) > 0 && (
                      <div className="font-mono text-[9px] text-emerald-400/90">+{row.yesterday_points} last night</div>
                    )}
                  </div>
                  {mode === "props" && row.hit_rate != null ? (
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">hit</span>
                      <span className="font-display text-[11px] font-bold tabular-nums text-ink-300">{row.hit_rate}%</span>
                    </div>
                  ) : row.hits !== undefined && row.hits > 0 ? (
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">hits</span>
                      <span className="font-display text-[11px] font-bold tabular-nums text-ink-300">{row.hits}</span>
                    </div>
                  ) : null}
                  <div className="flex flex-col items-end">
                    <span className={cn("font-display text-[18px] font-black tabular-nums leading-none", isR1Champ ? "text-yellow-400" : row.rank === 1 && leaderPoints > 0 ? "text-yellow-400" : isMe ? "text-brand" : "text-ink-100")}>
                      {formatPoints(row.points)}
                    </span>
                    <span className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-ink-500">pts</span>
                  </div>
                </div>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}