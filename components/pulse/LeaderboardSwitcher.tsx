"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, haptic, formatPoints } from "@/lib/utils";
import UserBracketDrawer from "./UserBracketDrawer";

type Row = {
  user_id: string;
  gamertag: string;
  points: number;
  hits?: number;
  max_streak?: number;
  rank: number;
  yesterday_points?: number;
  hit_rate?: number | null;
};

type BracketPick = { user_id: string; series_id: string; picked_team_id: string };
type Profile = { user_id: string; gamertag: string };

export default function LeaderboardSwitcher({
  bracket,
  propsR1,
  propsR2,
  r1Done,
  currentUserId,
  series,
  allBracketPicks,
  profiles,
}: {
  bracket: Row[];
  propsR1: Row[];
  propsR2?: Row[] | null;
  r1Done?: boolean;
  currentUserId: string;
  series?: any[];
  allBracketPicks?: BracketPick[];
  profiles?: Profile[];
}) {
  const [mode, setMode] = useState<"bracket" | "props">("bracket");
  const r2HasData = !!propsR2 && propsR2.length > 0;
  const [propsRound, setPropsRound] = useState<1 | 2>(r2HasData ? 2 : 1);
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);

  const propsRows = propsRound === 1 ? propsR1 : (propsR2 ?? []);
  const rows = mode === "bracket" ? bracket : propsRows;

  const canOpenBracket = mode === "bracket" && !!series && !!allBracketPicks && !!profiles;
  const openBracket = (uid: string) => {
    if (!canOpenBracket) return;
    haptic("light");
    setDrawerUserId(uid);
  };

  // Tier slicing — group by distinct ranks (handles ties correctly)
  // Gold = rank #1, Silver = next rank, Bronze = next after that, Pack = rest.
  const { gold, silver, bronze, pack, podiumIds } = useMemo(() => {
    if (rows.length === 0) return { gold: [] as Row[], silver: [] as Row[], bronze: [] as Row[], pack: [] as Row[], podiumIds: new Set<string>() };
    const tierForRank = (rank: number, distinctRanks: number[]): "gold" | "silver" | "bronze" | "pack" => {
      const idx = distinctRanks.indexOf(rank);
      if (idx === 0) return "gold";
      if (idx === 1) return "silver";
      if (idx === 2) return "bronze";
      return "pack";
    };
    const distinct = Array.from(new Set(rows.map((r) => r.rank))).sort((a, b) => a - b);
    const g: Row[] = []; const s: Row[] = []; const b: Row[] = []; const p: Row[] = [];
    for (const row of rows) {
      const t = tierForRank(row.rank, distinct);
      if (t === "gold") g.push(row);
      else if (t === "silver") s.push(row);
      else if (t === "bronze") b.push(row);
      else p.push(row);
    }
    const ids = new Set([...g, ...s, ...b].map((r) => r.user_id));
    return { gold: g, silver: s, bronze: b, pack: p, podiumIds: ids };
  }, [rows]);

  const showR1Champ = mode === "props" && propsRound === 1 && !!r1Done && rows[0]?.points > 0;
  const meInPack = pack.some((r) => r.user_id === currentUserId);
  const meInPodium = !meInPack && podiumIds.has(currentUserId);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-gradient-to-b from-ink-850 to-ink-900">
        {/* Toggle */}
        <div className="flex items-center justify-between border-b border-ink-700/50 bg-ink-900/80 px-3 py-2">
          <div className="flex rounded-md bg-ink-800 p-0.5">
            {(["bracket", "props"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { haptic("light"); setMode(m); }}
                className={cn(
                  "rounded px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.15em] transition",
                  mode === m ? "bg-brand text-ink-900 shadow-sm shadow-brand/30" : "text-ink-400",
                )}
              >
                {m === "bracket" ? "Bracket" : "Props"}
              </button>
            ))}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
            {mode === "bracket" ? "Main pot" : "$100 per round"}
          </span>
        </div>

        {/* Props sub-toggle */}
        {mode === "props" && r2HasData && (
          <div className="flex items-center justify-between border-b border-ink-700/40 bg-ink-900/40 px-3 py-1.5">
            <div className="flex rounded-md bg-ink-800 p-0.5">
              {([1, 2] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => { haptic("light"); setPropsRound(r); }}
                  className={cn(
                    "flex items-center gap-1 rounded px-2.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider transition",
                    propsRound === r ? "bg-brand text-ink-900" : "text-ink-400",
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
            className="p-3"
          >
            {rows.length === 0 ? (
              <div className="px-2 py-8 text-center text-[12px] text-ink-400">No points yet.</div>
            ) : (
              <div className="space-y-3">
                {/* Podium */}
                <div className="space-y-2">
                  {gold.length > 0 && (
                    <PodiumTier
                      tier="gold"
                      rows={gold}
                      mode={mode}
                      currentUserId={currentUserId}
                      onRowClick={canOpenBracket ? openBracket : undefined}
                      r1Champ={showR1Champ}
                    />
                  )}
                  {silver.length > 0 && (
                    <PodiumTier
                      tier="silver"
                      rows={silver}
                      mode={mode}
                      currentUserId={currentUserId}
                      onRowClick={canOpenBracket ? openBracket : undefined}
                    />
                  )}
                  {bronze.length > 0 && (
                    <PodiumTier
                      tier="bronze"
                      rows={bronze}
                      mode={mode}
                      currentUserId={currentUserId}
                      onRowClick={canOpenBracket ? openBracket : undefined}
                    />
                  )}
                </div>

                {/* Pack */}
                {pack.length > 0 && (
                  <div className="rounded-xl border border-ink-700/60 bg-ink-900/40">
                    <div className="flex items-center justify-between border-b border-ink-700/40 px-3 py-1.5">
                      <span className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-ink-500">
                        Chasing pack
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
                        {mode === "props" ? "hits · pts" : "pts"}
                      </span>
                    </div>
                    <div className="divide-y divide-ink-700/30">
                      {pack.map((row) => (
                        <PackRow
                          key={row.user_id}
                          row={row}
                          leaderPoints={rows[0]?.points ?? 0}
                          mode={mode}
                          isMe={row.user_id === currentUserId}
                          onClick={canOpenBracket ? () => openBracket(row.user_id) : undefined}
                        />
                      ))}
                    </div>
                    {meInPodium && (
                      <div className="border-t border-ink-700/40 bg-brand/5 px-3 py-1.5 text-center font-mono text-[9px] uppercase tracking-wider text-brand">
                        You&apos;re on the podium ↑
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {canOpenBracket && (
        <UserBracketDrawer
          open={drawerUserId !== null}
          userId={drawerUserId}
          currentUserId={currentUserId}
          series={series!}
          allBracketPicks={allBracketPicks!}
          profiles={profiles!}
          leaderboard={bracket}
          onClose={() => setDrawerUserId(null)}
        />
      )}
    </>
  );
}

// ───────────────────────── Podium ─────────────────────────

type Tier = "gold" | "silver" | "bronze";

const TIER_STYLE: Record<Tier, {
  medal: string;
  label: string;
  border: string;
  bg: string;
  accent: string;
  ptsColor: string;
}> = {
  gold: {
    medal: "🥇",
    label: "Leader",
    border: "border-yellow-500/45",
    bg: "bg-gradient-to-br from-yellow-500/[0.14] via-yellow-600/[0.06] to-transparent shadow-[0_0_24px_-6px_rgba(234,179,8,0.4)]",
    accent: "text-yellow-300",
    ptsColor: "text-yellow-300",
  },
  silver: {
    medal: "🥈",
    label: "2nd",
    border: "border-slate-300/40",
    bg: "bg-gradient-to-br from-slate-200/[0.10] via-slate-400/[0.05] to-transparent",
    accent: "text-slate-200",
    ptsColor: "text-slate-100",
  },
  bronze: {
    medal: "🥉",
    label: "3rd",
    border: "border-amber-700/45",
    bg: "bg-gradient-to-br from-amber-700/[0.14] via-amber-900/[0.06] to-transparent",
    accent: "text-amber-300",
    ptsColor: "text-amber-200",
  },
};

function PodiumTier({
  tier,
  rows,
  mode,
  currentUserId,
  onRowClick,
  r1Champ,
}: {
  tier: Tier;
  rows: Row[];
  mode: "bracket" | "props";
  currentUserId: string;
  onRowClick?: (uid: string) => void;
  r1Champ?: boolean;
}) {
  const style = TIER_STYLE[tier];
  const points = rows[0]?.points ?? 0;
  const tied = rows.length > 1;
  const showChamp = tier === "gold" && r1Champ;

  return (
    <div className={cn("overflow-hidden rounded-xl border", style.border, style.bg)}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[18px] leading-none">{style.medal}</span>
          <span className={cn("font-display text-[10px] font-black uppercase tracking-[0.25em]", style.accent)}>
            {showChamp ? "R1 Winner" : tied ? `Tied · ${style.label}` : style.label}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn("font-display text-[24px] font-black tabular-nums leading-none", style.ptsColor)}>
            {formatPoints(points)}
          </span>
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">pts</span>
        </div>
      </div>

      <div className="divide-y divide-ink-700/30 border-t border-ink-700/30">
        {rows.map((row) => {
          const isMe = row.user_id === currentUserId;
          const Tag: any = onRowClick ? "button" : "div";
          return (
            <Tag
              key={row.user_id}
              {...(onRowClick ? { type: "button", onClick: () => onRowClick(row.user_id) } : {})}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-left transition",
                onRowClick && "active:bg-ink-800/40",
              )}
            >
              <div className={cn(
                "flex h-8 w-8 flex-none items-center justify-center rounded-full font-display text-[11px] font-black",
                tier === "gold" ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40" :
                tier === "silver" ? "bg-slate-300/15 text-slate-100 ring-1 ring-slate-300/30" :
                "bg-amber-700/20 text-amber-200 ring-1 ring-amber-700/40",
              )}>
                {row.rank}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className={cn("truncate font-display text-[14px] font-bold leading-tight", isMe ? "text-brand" : "text-ink-100")}>
                    {row.gamertag}
                  </span>
                  {isMe && <span className="rounded-sm bg-brand/15 px-1 font-mono text-[8px] font-black uppercase tracking-wider text-brand">you</span>}
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-ink-500">
                  {mode === "props" && row.hit_rate != null && <span>{row.hit_rate}% hit</span>}
                  {mode === "props" && row.hits !== undefined && <span>{row.hits} hits</span>}
                  {(row.yesterday_points ?? 0) > 0 && (
                    <span className="text-emerald-400/90">+{row.yesterday_points} last night</span>
                  )}
                  {(row.max_streak ?? 0) >= 2 && mode === "bracket" && (
                    <span className="text-amber-400">🔥 ×{row.max_streak}</span>
                  )}
                </div>
              </div>
              {onRowClick && <span className="font-mono text-[14px] leading-none text-ink-600">›</span>}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── Pack ─────────────────────────

function PackRow({
  row,
  leaderPoints,
  mode,
  isMe,
  onClick,
}: {
  row: Row;
  leaderPoints: number;
  mode: "bracket" | "props";
  isMe: boolean;
  onClick?: () => void;
}) {
  const back = leaderPoints - row.points;
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-1.5 text-left transition",
        onClick && "active:bg-ink-800/40",
        isMe && "bg-brand/[0.06] ring-1 ring-inset ring-brand/30",
      )}
    >
      <span className={cn("flex h-6 w-6 flex-none items-center justify-center rounded font-mono text-[10px] font-black tabular-nums", isMe ? "bg-brand/20 text-brand" : "bg-ink-800 text-ink-500")}>
        {row.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("truncate font-display text-[12px] font-bold leading-tight", isMe ? "text-brand" : "text-ink-100")}>
            {row.gamertag}
          </span>
          {isMe && <span className="rounded-sm bg-brand/15 px-1 font-mono text-[8px] font-black uppercase tracking-wider text-brand">you</span>}
        </div>
      </div>
      {mode === "props" && row.hits !== undefined && (
        <span className="font-display text-[11px] font-bold tabular-nums text-ink-400">{row.hits}</span>
      )}
      <span className="font-mono text-[10px] tabular-nums text-ink-500">−{back}</span>
      <span className={cn("font-display text-[14px] font-black tabular-nums leading-none", isMe ? "text-brand" : "text-ink-100")}>
        {formatPoints(row.points)}
      </span>
      {onClick && <span className="font-mono text-[14px] leading-none text-ink-600">›</span>}
    </Tag>
  );
}