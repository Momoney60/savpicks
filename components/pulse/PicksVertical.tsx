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
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-6 text-center">
        <p className="text-[12px] text-ink-400">No picks yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {r1.map((s) => {
        const sPicks = picks.filter((p) => p.series_id === s.id);
        const isLocked = !!s.picks_lock_at && new Date(s.picks_lock_at) < now;
        const tA = s.team_a;
        const tB = s.team_b;
        const countA = sPicks.filter((p) => p.picked_team_id === tA?.id).length;
        const countB = sPicks.filter((p) => p.picked_team_id === tB?.id).length;

        return (
          <motion.div
            key={s.id}
            layout
            className="overflow-hidden rounded-xl border border-ink-700 bg-ink-850"
          >
            {/* Compact matchup header */}
            <div className="flex items-center justify-between border-b border-ink-700/60 bg-ink-900/40 px-3 py-2">
              <div className="flex items-center gap-1.5">
                {tA?.logo_url && (
                  <img src={tA.logo_url} alt="" className="h-5 w-5 object-contain" />
                )}
                <span className="font-display text-[11px] font-bold text-ink-100">
                  {tA?.short_name}
                </span>
                <span className="font-mono text-[9px] text-ink-500">vs</span>
                <span className="font-display text-[11px] font-bold text-ink-100">
                  {tB?.short_name}
                </span>
                {tB?.logo_url && (
                  <img src={tB.logo_url} alt="" className="h-5 w-5 object-contain" />
                )}
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
                {isLocked
                  ? "🔒"
                  : s.picks_lock_at
                  ? new Date(s.picks_lock_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "TBD"}
              </span>
            </div>

            {/* Tally bar when locked */}
            {isLocked && sPicks.length > 0 && (
              <div className="flex items-center gap-1.5 border-b border-ink-700/40 bg-ink-900/30 px-3 py-1.5">
                <span className="font-mono text-[9px] text-ink-400">
                  {tA?.id} {countA}
                </span>
                <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="bg-brand"
                    style={{ width: `${sPicks.length ? (countA / sPicks.length) * 100 : 50}%` }}
                  />
                  <div
                    className="bg-loss/70"
                    style={{ width: `${sPicks.length ? (countB / sPicks.length) * 100 : 50}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-ink-400">
                  {countB} {tB?.id}
                </span>
              </div>
            )}

            {/* Compact pick rows */}
            <div className="divide-y divide-ink-700/30">
              {users.map((u) => {
                const pick = sPicks.find((p) => p.user_id === u.user_id);
                const isMe = u.user_id === currentUserId;
                const canSee = isMe || isLocked;
                const pickedTeam = pick?.picked_team_id === tA?.id ? tA : tB;

                return (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between px-3 py-1.5"
                  >
                    <span
                      className={cn(
                        "truncate text-[12px]",
                        isMe ? "font-bold text-brand" : "text-ink-300"
                      )}
                    >
                      {u.gamertag}
                      {isMe && <span className="ml-1 text-[9px] text-brand/60">(you)</span>}
                    </span>

                    {!pick ? (
                      <span className="font-mono text-[9px] text-ink-600">—</span>
                    ) : !canSee ? (
                      <span className="font-mono text-[10px] text-ink-500">🔒</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {pickedTeam?.logo_url && (
                          <img
                            src={pickedTeam.logo_url}
                            alt=""
                            className={cn(
                              "h-5 w-5 object-contain",
                              pick.is_correct === true &&
                                "rounded-full ring-1 ring-brand",
                              pick.is_correct === false && "ring-2 ring-rink-red/50 opacity-50"
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            "font-mono text-[10px] font-bold uppercase tracking-wider",
                            pick.is_correct === true && "text-brand",
                            pick.is_correct === false && "text-rink-red line-through",
                            pick.is_correct === null && "text-ink-200"
                          )}
                        >
                          {pickedTeam?.id}
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
