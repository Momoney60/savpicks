"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, haptic, formatPoints } from "@/lib/utils";

type Row = {
  user_id: string;
  gamertag: string;
  points: number;
  hits?: number;
  max_streak?: number;
  rank: number;
};

export default function LeaderboardSwitcher({
  bracket,
  props: propsLb,
  currentUserId,
}: {
  bracket: Row[];
  props: Row[];
  currentUserId: string;
}) {
  const [mode, setMode] = useState<"bracket" | "props">("bracket");
  const rows = mode === "bracket" ? bracket : propsLb;
  const subtitle = mode === "bracket" ? "Winner takes main pot" : "$100 to round leader";

  return (
    <div className="overflow-hidden rounded-3xl border border-ink-700/70 bg-ink-850 shadow-lg">
      <div className="flex items-center justify-between border-b border-ink-700/50 bg-ink-900/60 px-4 py-2.5">
        <div className="flex rounded-lg bg-ink-800 p-0.5">
          {(["bracket", "props"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                haptic("light");
                setMode(m);
              }}
              className={cn(
                "rounded-md px-3 py-1 font-display text-[11px] font-bold uppercase tracking-[0.15em] transition",
                mode === m ? "bg-brand text-ink-900" : "text-ink-400"
              )}
            >
              {m === "bracket" ? "Bracket" : "R1 Props"}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
          {subtitle}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: mode === "bracket" ? -8 : 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: mode === "bracket" ? 8 : -8 }}
          transition={{ duration: 0.18 }}
        >
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] text-ink-400">No points yet.</p>
            </div>
          ) : (
            rows.map((row, i) => {
              const isMe = row.user_id === currentUserId;
              return (
                <div
                  key={row.user_id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    i < rows.length - 1 && "border-b border-ink-700/40",
                    isMe && "bg-brand/5"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 flex-none items-center justify-center rounded-lg font-display text-[12px] font-black",
                      row.rank === 1 && "bg-brand text-ink-900",
                      row.rank === 2 && "bg-ink-200 text-ink-900",
                      row.rank === 3 && "bg-[#CD7F32] text-ink-900",
                      row.rank > 3 && "bg-ink-800 text-ink-400"
                    )}
                  >
                    {row.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "truncate font-display text-[14px] font-bold",
                        isMe ? "text-brand" : "text-ink-100"
                      )}
                    >
                      {row.gamertag}
                      {isMe && <span className="ml-1 text-[10px] text-brand/60">(you)</span>}
                    </div>
                    {(row.hits !== undefined ||
                      (row.max_streak !== undefined && row.max_streak >= 2)) && (
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-500">
                        {row.hits !== undefined && <span>{row.hits} hits</span>}
                        {row.max_streak !== undefined && row.max_streak >= 2 && (
                          <span className="font-bold text-brand">🔥 {row.max_streak}×</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-display text-[18px] font-black tabular-nums text-ink-100">
                      {formatPoints(row.points)}
                    </span>
                    <span className="ml-1 font-mono text-[9px] uppercase tracking-wider text-ink-500">
                      pts
                    </span>
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
