"use client";

import { motion, AnimatePresence } from "framer-motion";
import MiniBracket from "@/components/bracket/MiniBracket";
import { cn } from "@/lib/utils";

type BracketPick = { user_id: string; series_id: string; picked_team_id: string };
type Profile = { user_id: string; gamertag: string };
type LeaderboardRow = { user_id: string; gamertag: string; points: number; rank: number };

const CHIP_COLORS = ["bg-pink-600", "bg-rose-600", "bg-orange-600", "bg-amber-600", "bg-lime-600", "bg-emerald-600", "bg-teal-600", "bg-cyan-600", "bg-sky-600", "bg-indigo-600", "bg-violet-600", "bg-fuchsia-600"];
function chipColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h << 5) - h + userId.charCodeAt(i);
    h |= 0;
  }
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
}
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function UserBracketDrawer({
  open,
  userId,
  currentUserId,
  series,
  allBracketPicks,
  profiles,
  leaderboard,
  onClose,
}: {
  open: boolean;
  userId: string | null;
  currentUserId: string;
  series: any[];
  allBracketPicks: BracketPick[];
  profiles: Profile[];
  leaderboard: LeaderboardRow[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && userId && (() => {
        const profile = profiles.find((p) => p.user_id === userId);
        const lbRow = leaderboard.find((r) => r.user_id === userId);
        const myLbRow = leaderboard.find((r) => r.user_id === currentUserId);
        const userPicks = allBracketPicks
          .filter((p) => p.user_id === userId)
          .map((p) => ({ series_id: p.series_id, picked_team_id: p.picked_team_id }));
        const gamertag = profile?.gamertag ?? lbRow?.gamertag ?? "?";
        const isMe = userId === currentUserId;
        const diff = lbRow && myLbRow ? lbRow.points - myLbRow.points : 0;

        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-ink-700 bg-ink-850 pb-safe shadow-tier-4"
            >
              <div className="mx-auto mt-3 mb-2 h-1 w-12 rounded-full bg-ink-600" />

              <div className="flex items-center gap-3 px-5 pb-4 pt-1">
                <div className={cn("flex h-12 w-12 flex-none items-center justify-center rounded-full font-mono text-[14px] font-black text-white shadow-md", chipColor(userId))}>
                  {getInitials(gamertag)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate font-display text-[18px] font-black leading-tight text-ink-100">{gamertag}</span>
                    {isMe && <span className="rounded-sm bg-brand/15 px-1 font-mono text-[9px] font-black uppercase tracking-wider text-brand">YOU</span>}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-wider">
                    <span className="text-ink-500">Rank</span>
                    <span className="font-display text-[14px] font-black tabular-nums text-ink-200">#{lbRow?.rank ?? "—"}</span>
                    <span className="text-ink-700">·</span>
                    <span className="text-ink-500">Points</span>
                    <span className="font-display text-[14px] font-black tabular-nums text-ink-200">{lbRow?.points ?? 0}</span>
                  </div>
                  {!isMe && lbRow && myLbRow && (
                    <div className={cn("mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider", diff > 0 ? "text-rink-red" : diff < 0 ? "text-brand" : "text-ink-500")}>
                      {diff > 0 ? `+${diff} ahead of you` : diff < 0 ? `${-diff} behind you` : "tied with you"}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-ink-700 bg-ink-900 font-mono text-[14px] font-bold text-ink-300 transition active:scale-90"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="px-3 pb-6">
                <MiniBracket
                  series={series}
                  myPicks={userPicks}
                  allBracketPicks={allBracketPicks}
                  profiles={profiles}
                  currentUserId={userId}
                />
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
}