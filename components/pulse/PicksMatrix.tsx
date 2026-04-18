"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Team = { id: string; short_name: string; logo_url: string | null; primary_color: string | null };

type Series = {
  id: string;
  round: number;
  bracket_slot: string;
  picks_lock_at: string | null;
  team_a: Team | null;
  team_b: Team | null;
  winner_id: string | null;
};

type Pick = {
  user_id: string;
  series_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
  locked_at: string | null;
};

type User = { user_id: string; gamertag: string };

export default function PicksMatrix({
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
  const r1Series = series.filter((s) => s.round === 1).sort((a, b) => a.bracket_slot.localeCompare(b.bracket_slot));
  const now = new Date();

  if (r1Series.length === 0 || users.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-6 text-center">
        <p className="text-sm text-ink-400">No picks yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-none rounded-2xl border border-ink-700 bg-ink-850">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-ink-850 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Player
            </th>
            {r1Series.map((s) => (
              <th key={s.id} className="px-1 py-2 text-center text-[9px] font-bold text-ink-500">
                {s.team_a?.id}/{s.team_b?.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}>
              <td className={cn(
                "sticky left-0 z-10 bg-ink-850 px-3 py-2 font-display text-[13px] font-bold",
                u.user_id === currentUserId ? "text-brand" : "text-ink-100"
              )}>
                {u.gamertag}
                {u.user_id === currentUserId && <span className="ml-1 text-[9px] text-brand/60">(you)</span>}
              </td>
              {r1Series.map((s) => {
                const pick = picks.find((p) => p.user_id === u.user_id && p.series_id === s.id);
                const isLocked = s.picks_lock_at && new Date(s.picks_lock_at) < now;
                const canSee = u.user_id === currentUserId || isLocked;
                if (!pick) {
                  return (
                    <td key={s.id} className="px-1 py-1 text-center">
                      <div className="mx-auto h-8 w-8 rounded-full bg-ink-800 flex items-center justify-center text-[10px] text-ink-600">—</div>
                    </td>
                  );
                }
                if (!canSee) {
                  return (
                    <td key={s.id} className="px-1 py-1 text-center">
                      <div className="mx-auto h-8 w-8 rounded-full bg-ink-800 flex items-center justify-center text-[10px] text-ink-600">🔒</div>
                    </td>
                  );
                }
                const pickedTeam = pick.picked_team_id === s.team_a?.id ? s.team_a : s.team_b;
                const border = pick.is_correct === true ? "ring-2 ring-brand"
                  : pick.is_correct === false ? "ring-2 ring-loss opacity-40"
                  : "ring-1 ring-ink-700";
                return (
                  <td key={s.id} className="px-1 py-1 text-center">
                    {pickedTeam?.logo_url ? (
                      <motion.img
                        src={pickedTeam.logo_url}
                        alt={pickedTeam.short_name}
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className={cn("mx-auto h-8 w-8 rounded-full bg-ink-900 object-contain p-1", border)}
                        title={pickedTeam.short_name}
                      />
                    ) : (
                      <div className={cn("mx-auto h-8 w-8 rounded-full bg-ink-900 flex items-center justify-center text-[9px] font-bold", border)}>
                        {pickedTeam?.id}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
