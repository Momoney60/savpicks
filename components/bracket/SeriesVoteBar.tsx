"use client";

import { useMemo, useState } from "react";
import { cn, haptic } from "@/lib/utils";
import { streakDepth, flames, type StreakPick, type StreakSeries } from "@/lib/bracketStreaks";

type Team = {
  id: string;
  short_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
};

export type VoteSeries = StreakSeries & {
  team_a?: Team | null;
  team_b?: Team | null;
  picks_lock_at?: string | null;
};

type Profile = { user_id: string; gamertag: string };

const CHIP_COLORS = ["bg-pink-600","bg-rose-600","bg-orange-600","bg-amber-600","bg-lime-600","bg-emerald-600","bg-teal-600","bg-cyan-600","bg-sky-600","bg-indigo-600","bg-violet-600","bg-fuchsia-600"];
function chipColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) { h = (h << 5) - h + userId.charCodeAt(i); h |= 0; }
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
}
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function SeriesVoteBar({
  series,
  picks,
  allSeries,
  profiles,
  currentUserId,
  highlightTeamId,
}: {
  series: VoteSeries;
  picks: StreakPick[];
  allSeries?: StreakSeries[];
  profiles?: Profile[];
  currentUserId?: string;
  highlightTeamId?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const teamA = series.team_a;
  const teamB = series.team_b;
  const winnerId = series.winner_id;
  const aElim = !!(winnerId && winnerId !== teamA?.id);
  const bElim = !!(winnerId && winnerId !== teamB?.id);

  const seriesPicks = useMemo(
    () => picks.filter((p) => p.series_id === series.id),
    [picks, series.id],
  );

  const isLocked = useMemo(() => {
    if (series.status === "live" || series.status === "completed") return true;
    if (!series.picks_lock_at) return false;
    return new Date(series.picks_lock_at).getTime() <= Date.now();
  }, [series.status, series.picks_lock_at]);

  const countA = seriesPicks.filter((p) => p.picked_team_id === teamA?.id).length;
  const countB = seriesPicks.filter((p) => p.picked_team_id === teamB?.id).length;
  const total = countA + countB;
  const pctA = total > 0 ? Math.round((countA / total) * 100) : 0;
  const pctB = total > 0 ? 100 - pctA : 0;

  const myPick = currentUserId ? seriesPicks.find((p) => p.user_id === currentUserId)?.picked_team_id ?? null : null;

  const colorA = teamA?.primary_color ?? "#7dd3fc";
  const colorB = teamB?.primary_color ?? "#fbbf24";

  const aShort = teamA?.short_name ?? teamA?.id ?? "A";
  const bShort = teamB?.short_name ?? teamB?.id ?? "B";
  const statusLine = winnerId
    ? winnerId === teamA?.id
      ? `${aShort} won ${series.wins_a}-${series.wins_b}`
      : `${bShort} won ${series.wins_b}-${series.wins_a}`
    : series.status === "live"
      ? (series.wins_a ?? 0) > (series.wins_b ?? 0)
        ? `${aShort} leads ${series.wins_a}-${series.wins_b}`
        : (series.wins_b ?? 0) > (series.wins_a ?? 0)
          ? `${bShort} leads ${series.wins_b}-${series.wins_a}`
          : `tied ${series.wins_a ?? 0}-${series.wins_b ?? 0}`
      : isLocked
        ? "locked · puck drop soon"
        : "picks open";

  const userMap = useMemo(
    () => Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.gamertag])),
    [profiles],
  );
  const computeRow = (userId: string, teamId: string | undefined) => {
    if (!teamId) return { user_id: userId, name: userMap[userId] ?? "?", streak: 0 };
    const streak = allSeries ? streakDepth(userId, teamId, series.round, picks, allSeries) : 0;
    return { user_id: userId, name: userMap[userId] ?? "?", streak };
  };
  const pickersA = useMemo(
    () => seriesPicks.filter((p) => p.picked_team_id === teamA?.id).map((p) => computeRow(p.user_id, teamA?.id)).sort((a, b) => b.streak - a.streak),
    [seriesPicks, teamA?.id, allSeries, profiles],
  );
  const pickersB = useMemo(
    () => seriesPicks.filter((p) => p.picked_team_id === teamB?.id).map((p) => computeRow(p.user_id, teamB?.id)).sort((a, b) => b.streak - a.streak),
    [seriesPicks, teamB?.id, allSeries, profiles],
  );

  const canExpand = total > 0 && (isLocked || pickersA.length > 0 || pickersB.length > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-900/60">
      <button
        type="button"
        onClick={() => {
          if (!canExpand) return;
          haptic("light");
          setExpanded((v) => !v);
        }}
        disabled={!canExpand}
        className={cn(
          "w-full p-3 text-left transition",
          canExpand && "active:bg-ink-800/30",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-ink-500">
            Round {series.round} <span className="mx-1 text-ink-700">·</span> <span className="text-ink-300">{statusLine}</span>
          </span>
          {canExpand && (
            <span className="flex-none font-mono text-[10px] text-ink-500">{expanded ? "▾" : "▸"}</span>
          )}
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <TeamHeader team={teamA} elim={aElim} highlight={highlightTeamId === teamA?.id} myPick={myPick === teamA?.id} align="left" />
          <span className="font-mono text-[10px] font-black text-ink-600">VS</span>
          <TeamHeader team={teamB} elim={bElim} highlight={highlightTeamId === teamB?.id} myPick={myPick === teamB?.id} align="right" />
        </div>

        {!isLocked && total === 0 ? (
          <div className="rounded-md border border-dashed border-ink-700 px-3 py-2 text-center font-mono text-[9px] uppercase tracking-wider text-ink-500">
            Picks reveal at lock
          </div>
        ) : (
          <>
            <div className="relative h-6 overflow-hidden rounded-md bg-ink-950">
              {total > 0 && (
                <>
                  <div
                    className={cn("absolute inset-y-0 left-0 flex items-center justify-end px-2 font-display text-[10px] font-black tabular-nums text-ink-900 transition-all", aElim && "opacity-50")}
                    style={{ width: `${pctA}%`, background: colorA }}
                  >
                    {pctA >= 12 ? `${countA}` : ""}
                  </div>
                  <div
                    className={cn("absolute inset-y-0 right-0 flex items-center justify-start px-2 font-display text-[10px] font-black tabular-nums text-ink-900 transition-all", bElim && "opacity-50")}
                    style={{ width: `${pctB}%`, background: colorB }}
                  >
                    {pctB >= 12 ? `${countB}` : ""}
                  </div>
                </>
              )}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] font-bold uppercase tracking-wider">
              <span className={cn(aElim ? "text-ink-600" : "text-ink-300")}>{pctA}%</span>
              <span className="text-ink-600">{total} {total === 1 ? "pick" : "picks"}</span>
              <span className={cn(bElim ? "text-ink-600" : "text-ink-300")}>{pctB}%</span>
            </div>
          </>
        )}
      </button>

      {expanded && canExpand && (
        <div className="grid grid-cols-2 gap-px border-t border-ink-700/40 bg-ink-700/40">
          <PickerList
            pickers={pickersA}
            dim={aElim}
            currentUserId={currentUserId}
            emptyLabel={`No picks for ${aShort}`}
          />
          <PickerList
            pickers={pickersB}
            dim={bElim}
            currentUserId={currentUserId}
            emptyLabel={`No picks for ${bShort}`}
          />
        </div>
      )}
    </div>
  );
}

function PickerList({
  pickers,
  dim,
  currentUserId,
  emptyLabel,
}: {
  pickers: { user_id: string; name: string; streak: number }[];
  dim: boolean;
  currentUserId?: string;
  emptyLabel: string;
}) {
  if (pickers.length === 0) {
    return (
      <div className="bg-ink-900/60 p-2.5 text-center font-mono text-[9px] uppercase tracking-wider text-ink-600">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="space-y-1 bg-ink-900/60 p-2">
      {pickers.map((p) => {
        const isMe = p.user_id === currentUserId;
        return (
          <div
            key={p.user_id}
            className={cn("flex items-center gap-2 rounded-md px-1.5 py-1", dim && "opacity-50")}
          >
            <div className={cn("flex h-5 w-5 flex-none items-center justify-center rounded-full font-mono text-[8px] font-black text-white", chipColor(p.user_id))}>
              {getInitials(p.name)}
            </div>
            <span className={cn("min-w-0 flex-1 truncate font-display text-[11px] font-bold leading-tight", isMe ? "text-brand" : "text-ink-100")}>
              {p.name}
            </span>
            {p.streak > 0 && (
              <span className="flex-none font-mono text-[10px] leading-none text-amber-400">{flames(p.streak)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeamHeader({
  team,
  elim,
  highlight,
  myPick,
  align,
}: {
  team: Team | null | undefined;
  elim: boolean;
  highlight: boolean;
  myPick: boolean;
  align: "left" | "right";
}) {
  if (!team) return <div className="h-7 flex-1" />;
  const dim = elim ? "opacity-40 grayscale" : "";
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-1.5", align === "right" && "flex-row-reverse")}>
      {team.logo_url ? (
        <img src={team.logo_url} alt="" className={cn("h-7 w-7 flex-none object-contain", dim)} />
      ) : (
        <div className={cn("h-7 w-7 flex-none rounded-full bg-ink-700", dim)} />
      )}
      <div className={cn("flex min-w-0 flex-col", align === "right" && "items-end")}>
        <span className={cn(
          "truncate font-display text-[12px] font-bold leading-tight",
          elim ? "text-ink-500 line-through" : highlight ? "text-brand" : "text-ink-100",
        )}>
          {team.short_name ?? team.id}
        </span>
        {myPick && !elim && (
          <span className="font-mono text-[8px] font-black uppercase tracking-wider text-amber-400">your pick</span>
        )}
      </div>
    </div>
  );
}