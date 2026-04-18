"use client";

import { motion } from "framer-motion";
import type { LeaderboardRow } from "@/lib/types/database";
import { cn, formatPoints } from "@/lib/utils";

export default function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-6 text-center">
        <div className="text-4xl">🏒</div>
        <p className="mt-3 text-sm text-ink-400">
          No picks yet. Once Round 1 kicks off, the board lights up.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 shadow-card">
      {rows.map((row, i) => {
        const isTop3 = row.rank <= 3;
        return (
          <motion.div
            key={row.user_id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className={cn(
              "flex items-center gap-3 px-4 py-3.5",
              i < rows.length - 1 && "border-b border-ink-700/60"
            )}
          >
            {/* Rank chip */}
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-black",
                row.rank === 1 && "bg-brand text-ink-900",
                row.rank === 2 && "bg-ink-200 text-ink-900",
                row.rank === 3 && "bg-[#CD7F32] text-ink-900",
                !isTop3 && "bg-ink-800 text-ink-300"
              )}
            >
              {row.rank}
            </div>

            {/* Gamertag + stats */}
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[15px] font-bold text-ink-100">
                {row.gamertag}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-400">
                <span>
                  <span className="text-ink-300">{row.bracket_points}</span> bracket
                </span>
                <span className="text-ink-600">·</span>
                <span>
                  <span className="text-ink-300">{row.prop_points}</span> props
                </span>
                {row.max_streak >= 2 && (
                  <>
                    <span className="text-ink-600">·</span>
                    <span className="font-bold text-brand">🔥 {row.max_streak}x</span>
                  </>
                )}
              </div>
            </div>

            {/* Total points */}
            <div className="text-right">
              <div className="font-display text-xl font-black tabular-nums text-ink-100">
                {formatPoints(row.total_points)}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                pts
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
