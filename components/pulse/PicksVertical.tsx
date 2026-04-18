"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Team = { id: string; short_name: string; logo_url: string | null; primary_color: string | null };

type Series = {
  id: string;
  round: number;
  bracket_slot: string;
  picks_lock_at: string | null;
  winner_id: string | null;
  team_a: Team | null;
  team_b: Team | null;
};

type Pick = {
  user_id: string;
  series_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
  locked_at: string | null;
};

type User = { user_id: string; gamertag: string };

export default function PicksVertical({
  series,
  picks,
  users,
  currentUserId,
}: {
  series: Series[];
  picks: Pick[];
  users: User[];
  currentUserId: string;
}) {
  const r1 = series
    .filter((s) => s.round === 1)
    .sort((a, b) => (a.bracket_slot ?? "").localeCompare(b.bracket_slot ?? ""));
  const now = new Date();

  if (r1.length === 0 || users.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-8 text-center">
        <p className="text-sm text-ink-400">No picks yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {r1.map((s) => {
        const sPicks = picks.filter((p) => p.series_id === s.id);
        const isLocked =
          !!s.picks_lock_at && new Date(s.picks_lock_at) < now;
        const tA = s.team_a;
        const tB = s.team_b;
        const countA = sPicks.filter((p) => p.picked_team_id === tA?.id).length;
        const countB = sPicks.filter((p) => p.picked_team_id === tB?.id).length;
        const pctA = sPicks.length ? (countA / sPicks.length) * 100 : 50;

        return (
          <motion.div
            key={s.id}
            layout
            className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 shadow-card"
          >
            {/* Matchup header */}
            <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  {tA?.logo_url && (
                    <img src={tA.logo_url} alt="" className="h-7 w-7 object-contain" />
                  )}
                  <span className="font-display text-[13px] font-bold text-ink-100">
                    {tA?.short_name}
                  </span>
                </div>
                <span className="text-[9px] font-bold tracking-widest text-ink-500">VS</span>
                <div className="flex items-center gap-1.5">
                  {tB?.logo_url && (
                    <img src={tB.logo_url} alt="" className="h-7 w-7 object-contain" />
                  )}
                  <span className="font-display text-[13px] font-bold text-ink-100">
                    {tB?.short_name}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-ink-500">
                {isLocked
                  ? "🔒 Locked"
                  : s.picks_lock_at
                  ? new Date(s.picks_lock_at).toLocaleTimeString([], {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    } as any)
                  : "TBD"}
              </span>
            </div>

            {/* Pick split bar (visible post-lock) */}
            {isLocked && sPicks.length > 0 && (
              <div className="border-b border-ink-700/60 bg-ink-900/50 px-4 py-2.5">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-ink-300">
                    {tA?.short_name} · {countA}
                  </span>
                  <span className="text-ink-300">
                    {countB} · {tB?.short_name}
                  </span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="bg-brand transition-all"
                    style={{ width: `${pctA}%` }}
                  />
                  <div
                    className="bg-loss/70"
                    style={{ width: `${100 - pctA}%` }}
                  />
                </div>
              </div>
            )}

            {/* Rows */}
            <div className="divide-y divide-ink-700/40">
              {users.map((u) => {
                const pick = sPicks.find((p) => p.user_id === u.user_id);
                const isMe = u.user_id === currentUserId;
                const canSee = isMe || isLocked;
                const pickedTeam =
                  pick?.picked_team_id === tA?.id ? tA : tB;

                return (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-black",
                          isMe
                            ? "bg-brand text-ink-900"
                            : "bg-ink-700 text-ink-300"
                        )}
                      >
                        {u.gamertag.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={cn(
                          "truncate text-[13px] font-semibold",
                          isMe ? "text-brand" : "text-ink-200"
                        )}
                      >
                        {u.gamertag}
                        {isMe && (
                          <span className="ml-1 text-[10px] text-brand/60">(you)</span>
                        )}
                      </span>
                    </div>

                    {!pick ? (
                      <span className="text-[10px] text-ink-600">No pick</span>
                    ) : !canSee ? (
                      <div className="flex items-center gap-1 text-[11px] text-ink-500">
                        <span>🔒</span>
                        <span>Hidden</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {pickedTeam?.logo_url && (
                          <img
                            src={pickedTeam.logo_url}
                            alt=""
                            className={cn(
                              "h-8 w-8 object-contain",
                              pick.is_correct === true &&
                                "rounded-full ring-2 ring-brand",
                              pick.is_correct === false &&
                                "opacity-30 grayscale"
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            "font-display text-[12px] font-bold",
                            pick.is_correct === true && "text-brand",
                            pick.is_correct === false &&
                              "text-ink-500 line-through",
                            pick.is_correct === null && "text-ink-200"
                          )}
                        >
                          {pickedTeam?.short_name}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
