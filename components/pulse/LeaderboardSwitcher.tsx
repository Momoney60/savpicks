"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, haptic, formatPoints } from "@/lib/utils";

type Row = { user_id: string; gamertag: string; points: number; hits?: number; max_streak?: number; rank: number; };

export default function LeaderboardSwitcher({ bracket, props: propsLb, currentUserId }: { bracket: Row[]; props: Row[]; currentUserId: string; }) {
  const [mode, setMode] = useState<"bracket" | "props">("bracket");
  const rows = mode === "bracket" ? bracket : propsLb;
  const subtitle = mode === "bracket" ? "Main pot" : "$100 per round";

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-850">
      <div className="flex items-center justify-between border-b border-ink-700/50 bg-ink-900/60 px-3 py-2">
        <div className="flex rounded-md bg-ink-800 p-0.5">
          {(["bracket", "props"] as const).map((m) => (
            <button key={m} onClick={() => { haptic("light"); setMode(m); }} className={cn("rounded px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.15em] transition", mode === m ? "bg-brand text-ink-900" : "text-ink-400")}>
              {m === "bracket" ? "Bracket" : "Props"}
            </button>
          ))}
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{subtitle}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center"><p className="text-[12px] text-ink-400">No points yet.</p></div>
          ) : (
            rows.map((row, i) => {
              const isMe = row.user_id === currentUserId;
              return (
                <div key={row.user_id} className={cn("flex items-center gap-2.5 px-3 py-1.5", i < rows.length - 1 && "border-b border-ink-700/30", isMe && "bg-brand/5")}>
                  <div className={cn("flex h-5 w-5 flex-none items-center justify-center rounded font-mono text-[10px] font-black tabular-nums", row.rank === 1 && "bg-brand text-ink-900", row.rank === 2 && "bg-ink-200 text-ink-900", row.rank === 3 && "bg-[#CD7F32] text-ink-900", row.rank > 3 && "bg-ink-800 text-ink-400")}>{row.rank}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("truncate font-display text-[12px] font-bold", isMe ? "text-brand" : "text-ink-100")}>{row.gamertag}</span>
                      {isMe && <span className="font-mono text-[9px] text-brand/60">(you)</span>}
                      {row.max_streak !== undefined && row.max_streak >= 2 && <span className="font-mono text-[9px] font-bold text-brand">🔥{row.max_streak}×</span>}
                    </div>
                  </div>
                  {row.hits !== undefined && row.hits > 0 && (
                    <span className="font-mono text-[9px] text-ink-500">{row.hits}H</span>
                  )}
                  <span className="font-display text-[14px] font-black tabular-nums text-ink-100">{formatPoints(row.points)}</span>
                </div>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
