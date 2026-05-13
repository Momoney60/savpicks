"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type PropLite = { id: string; status: string; locks_at: string | null };
type PickLite = { user_id: string; prop_id: string };
type UserLite = { user_id: string; gamertag: string };

const CHIP_COLORS = [
  "bg-pink-600","bg-rose-600","bg-orange-600","bg-amber-600",
  "bg-lime-600","bg-emerald-600","bg-teal-600","bg-cyan-600",
  "bg-sky-600","bg-indigo-600","bg-violet-600","bg-fuchsia-600",
];
function chipColor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) { h = (h << 5) - h + uid.charCodeAt(i); h |= 0; }
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
}
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Compact "who's locked in" strip — pre-game prop pick status across the pool.
// Hides once every still-open prop is closed.
export default function TonightLockStatus({
  props,
  picks,
  users,
  currentUserId,
}: {
  props: PropLite[];
  picks: PickLite[];
  users: UserLite[];
  currentUserId?: string;
}) {
  const result = useMemo(() => {
    const now = Date.now();
    const open = props.filter((p) => p.status === "open" && (!p.locks_at || new Date(p.locks_at).getTime() > now));
    if (open.length === 0) return null;
    const openIds = new Set(open.map((p) => p.id));
    const counts: Record<string, number> = {};
    for (const pp of picks) {
      if (openIds.has(pp.prop_id)) counts[pp.user_id] = (counts[pp.user_id] ?? 0) + 1;
    }
    const ins: UserLite[] = [];
    const outs: UserLite[] = [];
    for (const u of users) {
      if ((counts[u.user_id] ?? 0) >= open.length) ins.push(u);
      else outs.push(u);
    }
    return { openCount: open.length, ins, outs };
  }, [props, picks, users]);

  if (!result || users.length === 0) return null;
  const { ins, outs } = result;

  const youFirst = (a: UserLite, b: UserLite) =>
    a.user_id === currentUserId ? -1 : b.user_id === currentUserId ? 1 : a.gamertag.localeCompare(b.gamertag);

  const sorted = [...ins.sort(youFirst), ...outs.sort(youFirst)];
  const inSet = new Set(ins.map((u) => u.user_id));

  return (
    <div className="mb-4 rounded-2xl border border-ink-700/60 bg-ink-900/40 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-ink-400">
          Locked in
        </span>
        <span className="font-mono text-[10px] font-bold tabular-nums text-ink-200">
          {ins.length}<span className="text-ink-600">/{users.length}</span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {sorted.map((u) => {
          const locked = inSet.has(u.user_id);
          const isMe = u.user_id === currentUserId;
          return (
            <span
              key={u.user_id}
              title={`${u.gamertag} — ${locked ? "locked in" : "no pick yet"}`}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full font-mono text-[9px] font-black",
                locked
                  ? `${chipColor(u.user_id)} text-white`
                  : "bg-ink-800 text-ink-600 ring-1 ring-ink-700",
                isMe && "ring-2 ring-brand ring-offset-1 ring-offset-ink-900",
              )}
            >
              {getInitials(u.gamertag)}
            </span>
          );
        })}
      </div>
    </div>
  );
}