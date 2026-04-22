"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, haptic } from "@/lib/utils";

type Team = { id: string; short_name: string; primary_color: string | null; logo_url: string | null; is_eliminated: boolean; };

type PlayerStat = { name: string; team: string; goals: number; assists: number; points: number; pim: number; };

type Game = {
  id: string;
  status: "scheduled" | "live" | "final";
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  period: string | null;
  clock: string | null;
  scheduled_at: string;
  player_stats?: PlayerStat[];
  total_pim?: number;
  home_team?: Team | null;
  away_team?: Team | null;
};

type Prop = {
  id: string;
  game_id: string | null;
  prop_type: "h2h_player" | "h2h_goalie" | "game_total_pim" | "game_total_goals" | "game_winner" | "next_team_to_score";
  status: "open" | "locked" | "resolved" | "void";
  points_reward: number;
  locks_at: string | null;
  metadata: any;
};

type PropPick = { id?: string; user_id?: string; prop_id: string; selection: any; is_correct?: boolean | null };
type PublicUser = { user_id: string; gamertag: string };

function propMatchesGame(prop: Prop, game: Game): boolean {
  // Strict match on NHL game_id — the only correct identity.
  // Old fuzzy team-set match incorrectly merged props across all games of a series
  // (Game 1 + Game 2 + Game 3... all show same teams, all would match).
  return prop.game_id === game.id;
}

export default function LiveView({ games, props, myPicks, allPropPicks = [], users = [], currentUserId }: {
  games: Game[]; props: Prop[]; myPicks: PropPick[]; allPropPicks?: PropPick[]; users?: PublicUser[]; currentUserId?: string;
}) {
  const orderedGames = [...games].sort((a, b) => {
    const rank = (g: Game) => (g.status === "live" ? 0 : g.status === "scheduled" ? 1 : 2);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });

  if (orderedGames.length === 0) {
    return (
      <div className="rounded-3xl border border-ink-700/70 bg-ink-850 p-10 text-center">
        <div className="text-5xl opacity-60">🏒</div>
        <p className="mt-4 font-display text-lg font-bold">No games today</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orderedGames.map((game) => {
        const gameProps = props.filter((p) => propMatchesGame(p, game) && p.prop_type !== "next_team_to_score");
        return (
          <GameCell key={game.id} game={game} props={gameProps} myPicks={myPicks} allPropPicks={allPropPicks} users={users} currentUserId={currentUserId} />
        );
      })}
    </div>
  );
}

function GameCell({ game, props, myPicks, allPropPicks, users, currentUserId }: { game: Game; props: Prop[]; myPicks: PropPick[]; allPropPicks: PropPick[]; users: PublicUser[]; currentUserId?: string; }) {
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const isLive = game.status === "live";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";
  const showStats = (isLive || isFinal) && (game.player_stats?.length ?? 0) > 0;
  const [collapsed, setCollapsed] = useState<boolean>(isFinal);

  return (
    <>
    <motion.div layout className={cn("overflow-hidden rounded-3xl border bg-ink-850", isLive ? "border-live/60 shadow-tier-live" : isFinal ? "border-ink-700/40 shadow-tier-1" : "border-ink-700/70 shadow-tier-2")}>
      <button onClick={() => isFinal && setCollapsed(!collapsed)} className={cn("w-full text-left", isFinal && "active:opacity-80 cursor-pointer")} disabled={!isFinal}>
        <StatusStrip game={game} />
        <div className="px-5 py-4">
          <TeamLine team={game.away_team} score={game.away_score} live={isLive} winning={game.away_score > game.home_score && (isLive || isFinal)} final={isFinal} scheduled={isScheduled} />
          <div className="my-3 h-px bg-ink-700/40" />
          <TeamLine team={game.home_team} score={game.home_score} live={isLive} winning={game.home_score > game.away_score && (isLive || isFinal)} final={isFinal} scheduled={isScheduled} />
        </div>
      </button>

      {isFinal && collapsed && (
        <div className="border-t border-ink-700/40 bg-ink-900/40 px-5 py-1.5 text-center font-mono text-[9px] uppercase tracking-wider text-ink-500">
          Tap to expand stats + markets
        </div>
      )}

      {!collapsed && (
        <>
          {showStats && <LiveStatsPanel game={game} props={props} />}
          {props.length > 0 && (
            <>
              <div className="flex items-center justify-between border-t border-ink-700/50 bg-ink-900/40 px-5 py-2.5">
                <span className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-ink-300">Markets</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{props.length} {props.length === 1 ? "market" : "markets"}</span>
              </div>
              <div className="divide-y divide-ink-700/40">
                {props.sort((a, b) => PROP_ORDER[a.prop_type] - PROP_ORDER[b.prop_type]).map((p) => (
                  <div key={p.id}>
                    <PropRow prop={p} existingPick={myPicks.find((m) => m.prop_id === p.id)} />
                    {!isScheduled && <RinkCard prop={p} allPropPicks={allPropPicks} users={users} currentUserId={currentUserId} game={game} onChipClick={(uid) => setDrawerUserId(uid)} />}
                    <PropResultBanner prop={p} game={game} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </motion.div>
    <AnimatePresence>
      {drawerUserId && (
        <UserPicksDrawer userId={drawerUserId} users={users} propsForGame={props} allPropPicks={allPropPicks} onClose={() => setDrawerUserId(null)} />
      )}
    </AnimatePresence>
    </>
  );
}

function LiveStatsPanel({ game, props }: { game: Game; props: Prop[] }) {
  // Find the h2h matchup prop (player or goalie). Stat = metadata.stat ("points"|"pim"|"shots"|"saves")
  const h2hProp = props.find((p) => p.prop_type === "h2h_player" || p.prop_type === "h2h_goalie");
  // Find the game-total prop (pim or goals)
  const totalProp = props.find((p) => p.prop_type === "game_total_pim" || p.prop_type === "game_total_goals");

  const matchByLastName = (full: string) => {
    const parts = (full ?? "").trim().toLowerCase().split(/\s+/);
    const lastName = parts[parts.length - 1];
    if (!lastName) return undefined;
    return game.player_stats?.find((p) => {
      const pParts = (p.name ?? "").trim().toLowerCase().split(/\s+/);
      return pParts[pParts.length - 1] === lastName;
    });
  };
  const playerA = matchByLastName(h2hProp?.metadata?.player_a_name ?? "");
  const playerB = matchByLastName(h2hProp?.metadata?.player_b_name ?? "");

  // Stat selector: pulls the right field off player_stats based on metadata.stat
  const h2hStat: string = h2hProp?.prop_type === "h2h_goalie" ? "saves" : (h2hProp?.metadata?.stat ?? "points");
  const readStat = (p: any): number => {
    if (!p) return 0;
    if (h2hStat === "pim") return p.pim ?? 0;
    if (h2hStat === "saves") return (p as any).saves ?? 0;
    if (h2hStat === "shots") return (p as any).shots ?? 0;
    return p.points ?? 0;
  };
  const aVal = readStat(playerA);
  const bVal = readStat(playerB);
  const statLabel = h2hStat === "pim" ? "PIM" : h2hStat === "saves" ? "SV" : h2hStat === "shots" ? "SOG" : "PTS";
  const h2hSectionLabel =
    h2hStat === "pim" ? "PIM Duel" :
    h2hStat === "saves" ? "Saves Duel" :
    h2hStat === "shots" ? "Shots Duel" :
    "Points Duel";

  // Total-prop section: read line and current total based on prop type
  const isGoalsTotal = totalProp?.prop_type === "game_total_goals";
  const totalLine = totalProp ? parseFloat(totalProp.metadata?.line ?? "0") : 0;
  const currentTotal = isGoalsTotal
    ? ((game.home_score ?? 0) + (game.away_score ?? 0))
    : (game.total_pim ?? 0);
  const totalUnit = isGoalsTotal ? "goals" : "min";
  const totalSectionLabel = isGoalsTotal ? "Total Goals" : "Total PIM";
  const totalHighlight = totalProp && currentTotal > totalLine;

  if (!h2hProp && !totalProp) return null;

  return (
    <div className="border-t border-ink-700/50 bg-ink-900/40 px-5 py-3">
      <div className="flex items-stretch gap-4">
        {totalProp && (
          <div className="flex-1 border-r border-ink-700/40 pr-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">
              Line {totalLine}
            </div>
            <div className="font-display text-[11px] font-bold text-ink-200">{totalSectionLabel}</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className={cn("font-display text-[24px] font-black tabular-nums leading-none", totalHighlight ? "text-brand" : "text-ink-100")}>
                {currentTotal}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{totalUnit}</span>
            </div>
          </div>
        )}

        {h2hProp && (
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">
              {h2hSectionLabel}
            </div>
            <div className="mt-0.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[9px] font-bold tracking-wider text-ink-500">
                    {playerA?.team ?? h2hProp.metadata?.player_a_team ?? ""}
                  </span>
                  <span className={cn("truncate font-display text-[12px] font-bold", aVal > bVal ? "text-brand" : "text-ink-200")}>
                    {lastName(h2hProp.metadata?.player_a_name ?? "")}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn("font-display text-[15px] font-black tabular-nums", aVal > bVal ? "text-brand" : "text-ink-300")}>
                    {aVal}
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-ink-500">{statLabel}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[9px] font-bold tracking-wider text-ink-500">
                    {playerB?.team ?? h2hProp.metadata?.player_b_team ?? ""}
                  </span>
                  <span className={cn("truncate font-display text-[12px] font-bold", bVal > aVal ? "text-brand" : "text-ink-200")}>
                    {lastName(h2hProp.metadata?.player_b_name ?? "")}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn("font-display text-[15px] font-black tabular-nums", bVal > aVal ? "text-brand" : "text-ink-300")}>
                    {bVal}
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-ink-500">{statLabel}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : full;
}

function StatCell({ label, sub, value, unit, highlight }: { label: string; sub: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">{sub}</span>
      <span className="truncate font-display text-[12px] font-bold text-ink-200">{label}</span>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={cn("font-display text-[20px] font-black tabular-nums leading-none", highlight ? "text-brand" : "text-ink-100")}>
          {value}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{unit}</span>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const CHIP_COLORS = ["bg-pink-600", "bg-rose-600", "bg-orange-600", "bg-amber-600", "bg-lime-600", "bg-emerald-600", "bg-teal-600", "bg-cyan-600", "bg-sky-600", "bg-indigo-600", "bg-violet-600", "bg-fuchsia-600"];

function chipColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h << 5) - h + userId.charCodeAt(i);
    h |= 0;
  }
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
}

function RinkCard({ prop, allPropPicks, users, currentUserId, game, onChipClick }: { prop: Prop; allPropPicks: PropPick[]; users: PublicUser[]; currentUserId?: string; game: Game; onChipClick: (userId: string) => void; }) {
  const userMap = Object.fromEntries(users.map((u) => [u.user_id, u.gamertag]));
  const propPicks = allPropPicks.filter((p) => p.prop_id === prop.id && p.user_id);
  const opts = getPropOptions(prop);
  if (opts === undefined || opts.length < 2) return null;

  const bySel: Record<string, string[]> = {};
  propPicks.forEach((p) => {
    const sel = String(p.selection);
    if (bySel[sel] === undefined) bySel[sel] = [];
    bySel[sel].push(p.user_id!);
  });

  const sideAUsers = bySel[opts[0].value] ?? [];
  const sideBUsers = bySel[opts[1].value] ?? [];

  const renderHeader = (isA: boolean) => {
    const opt = isA ? opts[0] : opts[1];
    if (prop.prop_type === "h2h_player" || prop.prop_type === "h2h_goalie") {
      const name = isA ? prop.metadata?.player_a_name : prop.metadata?.player_b_name;
      const team = isA ? prop.metadata?.player_a_team : prop.metadata?.player_b_team;
      const headshot = isA ? prop.metadata?.player_a_headshot : prop.metadata?.player_b_headshot;
      return (
        <div className="flex items-center gap-2">
          {headshot ? (
            <img src={headshot} alt={name} className="h-9 w-9 flex-none rounded-full border border-ink-700 bg-ink-800 object-cover" />
          ) : (
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink-700 font-mono text-[9px] font-black text-ink-300">
              {lastName(name ?? "").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-display text-[12px] font-bold leading-tight text-ink-100">{lastName(name ?? "")}</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{team}</div>
          </div>
        </div>
      );
    }
    if (prop.prop_type === "game_winner") {
      const teamObj = isA ? game.away_team : game.home_team;
      return (
        <div className="flex items-center gap-2">
          {teamObj?.logo_url ? (
            <img src={teamObj.logo_url} alt={teamObj.short_name} className="h-9 w-9 flex-none object-contain" />
          ) : (
            <div className="h-9 w-9 flex-none rounded-full bg-ink-700" />
          )}
          <div className="min-w-0">
            <div className="truncate font-display text-[12px] font-bold leading-tight text-ink-100">{teamObj?.short_name ?? opt.value}</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{isA ? "AWAY" : "HOME"}</div>
          </div>
        </div>
      );
    }
    const arrow = opt.value === "over" ? "\u25b2" : "\u25bc";
    const dirLabel = opt.value === "over" ? "OVER" : "UNDER";
    return (
      <div className="flex items-center gap-2">
        <span className="font-display text-[18px] font-black text-ink-300">{arrow}</span>
        <div>
          <div className="font-display text-[12px] font-bold leading-tight text-ink-100">{dirLabel}</div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{prop.metadata?.line ?? "-"}</div>
        </div>
      </div>
    );
  };

  const renderChips = (userIds: string[]) => {
    if (userIds.length === 0) {
      return <div className="mt-2 italic text-[10px] text-ink-600">No picks yet</div>;
    }
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {userIds.map((uid) => {
          const name = userMap[uid] ?? "?";
          const isMe = uid === currentUserId;
          return (
            <button
              key={uid}
              onClick={() => { haptic("light"); onChipClick(uid); }}
              title={name}
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[9px] font-black text-white transition-transform active:scale-90",
                chipColor(uid),
                isMe && "ring-2 ring-brand ring-offset-2 ring-offset-ink-900"
              )}
            >
              {getInitials(name)}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="border-t border-ink-700/30 bg-ink-900/20 px-4 py-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <div className="rounded-xl bg-ink-900/60 p-3 ring-1 ring-ink-700/40">
          {renderHeader(true)}
          <div className="mt-2 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">
            {sideAUsers.length} {sideAUsers.length === 1 ? "pick" : "picks"}
          </div>
          {renderChips(sideAUsers)}
        </div>
        <div className="flex h-full items-center pt-3">
          <span className="font-mono text-[10px] font-black text-ink-600">VS</span>
        </div>
        <div className="rounded-xl bg-ink-900/60 p-3 ring-1 ring-ink-700/40">
          {renderHeader(false)}
          <div className="mt-2 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">
            {sideBUsers.length} {sideBUsers.length === 1 ? "pick" : "picks"}
          </div>
          {renderChips(sideBUsers)}
        </div>
      </div>
    </div>
  );
}

function UserPicksDrawer({ userId, users, propsForGame, allPropPicks, onClose }: { userId: string; users: PublicUser[]; propsForGame: Prop[]; allPropPicks: PropPick[]; onClose: () => void; }) {
  const user = users.find((u) => u.user_id === userId);
  const gamertag = user?.gamertag ?? "?";
  const userPicks = allPropPicks.filter((p) => p.user_id === userId);
  const propIds = new Set(propsForGame.map((p) => p.id));
  const picksForGame = userPicks.filter((p) => propIds.has(p.prop_id));

  const propLabelOf = (prop: Prop): string => {
    if (prop.prop_type === "h2h_player") return `${prop.metadata?.player_a_name ?? "?"} vs ${prop.metadata?.player_b_name ?? "?"}`;
    if (prop.prop_type === "h2h_goalie") return `${prop.metadata?.player_a_name ?? "?"} vs ${prop.metadata?.player_b_name ?? "?"}`;
    if (prop.prop_type === "game_total_pim") return `PIMs O/U ${prop.metadata?.line ?? "-"}`;
    if (prop.prop_type === "game_total_goals") return `Goals O/U ${prop.metadata?.line ?? "-"}`;
    if (prop.prop_type === "game_winner") return "Game Winner";
    return "";
  };
  const selectionLabelOf = (prop: Prop, selection: any): string => {
    const sel = String(selection);
    if (prop.prop_type === "h2h_player" || prop.prop_type === "h2h_goalie") {
      return sel === "a" ? (prop.metadata?.player_a_name ?? "A") : (prop.metadata?.player_b_name ?? "B");
    }
    if (prop.prop_type === "game_total_pim" || prop.prop_type === "game_total_goals") {
      return sel === "over" ? `Over ${prop.metadata?.line ?? "-"}` : `Under ${prop.metadata?.line ?? "-"}`;
    }
    return sel;
  };

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
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-ink-700 bg-ink-850 p-6 pb-10 shadow-tier-4"
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-ink-600" />
        <div className="mb-5 flex items-center gap-3">
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-full font-mono text-[16px] font-black text-white", chipColor(userId))}>
            {getInitials(gamertag)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-[20px] font-black leading-tight text-ink-100">{gamertag}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">Picks this game</div>
          </div>
        </div>
        <div className="space-y-2">
          {propsForGame.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-ink-500">No props this game</div>
          ) : (
            propsForGame.map((prop) => {
              const pick = picksForGame.find((p) => p.prop_id === prop.id);
              const isResolved = prop.status === "resolved" || prop.status === "locked";
              return (
                <div key={prop.id} className="rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2.5">
                  <div className="truncate font-display text-[11px] font-bold text-ink-300">{propLabelOf(prop)}</div>
                  {pick ? (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate font-display text-[14px] font-black text-ink-100">{selectionLabelOf(prop, pick.selection)}</span>
                      {isResolved && pick.is_correct === true && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-brand/15 px-1 font-mono text-[11px] font-black text-brand">+{prop.points_reward}</span>
                      )}
                      {isResolved && pick.is_correct === false && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-rink-red/20 px-1 font-mono text-[11px] font-black text-rink-red">X</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 italic text-[11px] text-ink-600">No pick</div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <button onClick={onClose} className="mt-5 w-full rounded-xl border border-ink-700 bg-ink-800 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-300 transition active:scale-[0.98]">
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

const PROP_ORDER: Record<string, number> = { h2h_player: 0, h2h_goalie: 1, game_winner: 2, game_total_goals: 3, game_total_pim: 4, next_team_to_score: 5 };

function StatusStrip({ game }: { game: Game }) {
  const isLive = game.status === "live";
  const isFinal = game.status === "final";
  return (
    <div className={cn("flex items-center justify-between border-b px-5 py-2.5", isLive ? "bg-gradient-to-r from-live/15 via-live/[0.04] to-transparent border-live/40" : "bg-ink-900/60 border-ink-700/50")}>
      {isLive ? (
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
          </span>
          <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-live">Live</span>
          {game.period && (
            <>
              <span className="text-ink-600">·</span>
              <span className="font-mono text-[11px] font-semibold tabular-nums text-ink-200">{game.period}{game.clock ? ` ${game.clock}` : ""}</span>
            </>
          )}
        </div>
      ) : isFinal ? (
        <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-ink-300">Final</span>
      ) : (
        <Countdown target={game.scheduled_at} />
      )}
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
        {new Date(game.scheduled_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
      </span>
    </div>
  );
}

function Countdown({ target }: { target: string }) {
  const diff = new Date(target).getTime() - Date.now();
  const label = diff <= 0 ? "ABOUT TO START" : diff < 60 * 60 * 1000 ? `STARTS IN ${Math.ceil(diff / 60000)}M` : `${new Date(target).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} PUCK DROP`;
  return <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-ink-300">{label}</span>;
}

function TeamLine({ team, score, live, winning, final, scheduled }: { team: Team | null | undefined; score: number; live: boolean; winning: boolean; final: boolean; scheduled: boolean; }) {
  if (!team) return <div className="h-10" />;
  const isLosing = (live || final) && !winning && !scheduled;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {team.logo_url ? <img src={team.logo_url} alt="" className={cn("h-11 w-11 flex-none object-contain", team.is_eliminated && "opacity-30 grayscale")} /> : <div className="h-11 w-11 flex-none rounded-full bg-ink-700" />}
        <div className="min-w-0">
          <div className={cn("font-display text-[17px] font-bold leading-tight tracking-tight text-ink-100", team.is_eliminated && "text-ink-500 line-through")}>{team.short_name}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{team.id}</div>
        </div>
      </div>
      {scheduled ? <span className="font-mono text-3xl font-light tabular-nums text-ink-700">—</span> : <span className={cn("font-display text-[38px] font-black leading-none tabular-nums", winning && "text-ink-100", !winning && live && "text-rink-red", !winning && final && "text-rink-red/60")}>{score}</span>}
    </div>
  );
}

function PropRow({ prop, existingPick }: { prop: Prop; existingPick?: PropPick }) {
  const [selection, setSelection] = useState<string | null>(existingPick ? String(existingPick.selection) : null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const locked = prop.status !== "open";
  const options = getPropOptions(prop);
  const label = (
    prop.prop_type === "h2h_player"
      ? (prop.metadata?.stat === "pim" ? "PIM Duel" : prop.metadata?.stat === "shots" ? "Shots Duel" : "Points Duel")
      : prop.prop_type === "h2h_goalie" ? "Saves Duel"
      : prop.prop_type === "game_total_pim" ? "Total PIMs"
      : prop.prop_type === "game_total_goals" ? "Total Goals"
      : prop.prop_type === "game_winner" ? "Game Winner"
      : prop.prop_type === "next_team_to_score" ? "Next Goal"
      : ""
  );
  const sub = { h2h_player: `${prop.metadata?.player_a_name} vs ${prop.metadata?.player_b_name}`, h2h_goalie: `${prop.metadata?.player_a_name} vs ${prop.metadata?.player_b_name}`, game_total_pim: `Line · ${prop.metadata?.line ?? "—"}`, game_total_goals: `Line · ${prop.metadata?.line ?? "—"}`, game_winner: `${prop.metadata?.away_team ?? "AWAY"} @ ${prop.metadata?.home_team ?? "HOME"}`, next_team_to_score: "Who scores next?" }[prop.prop_type];

  async function pick(val: string) {
    if (locked) return;
    haptic("medium");
    setSelection(val);
    const res = await fetch("/api/picks/prop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prop_id: prop.id, selection: val }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSelection(existingPick ? String(existingPick.selection) : null);
      setErrorMsg(data?.error ?? "Failed");
      haptic("heavy");
      setTimeout(() => setErrorMsg(null), 3500);
    }
  }

  return (
    <div className="px-5 py-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-display text-[13px] font-bold leading-tight text-ink-100">{label}</div>
          <div className="mt-0.5 truncate text-[11px] text-ink-400">{sub}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider", locked ? "bg-ink-800 text-ink-500" : "bg-brand/10 text-brand")}>+{prop.points_reward}</span>
          {locked && <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">🔒</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const picked = selection === opt.value;
          return (
            <button key={opt.value} onClick={() => pick(opt.value)} disabled={locked} className={cn("relative flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition", picked ? "border-brand bg-brand/10" : "border-ink-700 bg-ink-900/60", !locked && !picked && "active:scale-[0.98] active:bg-ink-800", locked && "cursor-not-allowed opacity-80")}>
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">{opt.subtitle}</span>
              <span className={cn("font-display text-[13px] font-bold", picked ? "text-brand" : "text-ink-100")}>{opt.label}</span>
              {picked && <span className="absolute right-2 top-2 font-mono text-[9px] font-black uppercase text-brand">✓</span>}
            </button>
          );
        })}
      </div>
      {errorMsg && <div className="mt-2 rounded-lg border border-loss/40 bg-loss/10 px-3 py-1.5 text-[11px] font-semibold text-loss">{errorMsg}</div>}
    </div>
  );
}

function PropResultBanner({ prop, game }: { prop: Prop; game: Game }) {
  const isResolved = prop.status === "resolved" || prop.status === "locked" || prop.status === "void";
  if (!isResolved || !prop.outcome) return null;
  const outcome = prop.outcome as any;

  if (prop.prop_type === "h2h_player" || prop.prop_type === "h2h_goalie") {
    const aName = prop.metadata?.player_a_name ?? "A";
    const bName = prop.metadata?.player_b_name ?? "B";
    const aTeam = prop.metadata?.player_a_team ?? "";
    const bTeam = prop.metadata?.player_b_team ?? "";
    const aPts = outcome.player_a_value ?? outcome.player_a_pts ?? 0;
    const bPts = outcome.player_b_value ?? outcome.player_b_pts ?? 0;
    const winner = outcome.winner;
    const isTie = winner === "tie";
    const statLabel = outcome.stat === "saves" ? "sv" : outcome.stat === "pim" ? "pim" : "pts";

    return (
      <div className="border-t border-ink-700/40 bg-gradient-to-r from-ink-900/60 via-ink-850 to-ink-900/60 px-5 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-ink-400">Result</span>
          {isTie ? (
            <span className="rounded-md bg-ink-700 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-ink-300">Push</span>
          ) : (
            <span className="rounded-md bg-brand/15 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-brand">+5 Awarded</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className={cn("flex-1 rounded-md px-2 py-1", winner === "a" ? "" : "bg-rink-red/[0.08] ring-1 ring-rink-red/20")}>
            <div className="flex items-baseline gap-1.5">
              <span className={cn("font-display text-[14px] font-bold", winner === "a" ? "text-brand" : "text-ink-300")}>{lastName(aName)}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{aTeam}</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className={cn("font-display text-[22px] font-black tabular-nums", winner === "a" ? "text-brand" : "text-ink-400")}>{aPts}</span>
              <span className="font-mono text-[9px] uppercase text-ink-500">{statLabel}</span>
              {winner === "a" && <span className="ml-1 text-[12px]">🏆</span>}
            </div>
          </div>
          <span className="font-mono text-[10px] text-ink-600">VS</span>
          <div className={cn("flex-1 rounded-md px-2 py-1 text-right", winner === "b" ? "" : "bg-rink-red/[0.08] ring-1 ring-rink-red/20")}>
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{bTeam}</span>
              <span className={cn("font-display text-[14px] font-bold", winner === "b" ? "text-brand" : "text-ink-300")}>{lastName(bName)}</span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-end gap-1">
              {winner === "b" && <span className="mr-1 text-[12px]">🏆</span>}
              <span className={cn("font-display text-[22px] font-black tabular-nums", winner === "b" ? "text-brand" : "text-ink-400")}>{bPts}</span>
              <span className="font-mono text-[9px] uppercase text-ink-500">{statLabel}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (prop.prop_type === "game_total_pim" || prop.prop_type === "game_total_goals") {
    const line = parseFloat(prop.metadata?.line ?? "0");
    const isGoalsProp = prop.prop_type === "game_total_goals";
    const totalPim = isGoalsProp
      ? (outcome.total_goals ?? ((game.home_score ?? 0) + (game.away_score ?? 0)))
      : (outcome.total_pim ?? game.total_pim ?? 0);
    const totalLabel = isGoalsProp ? "GOALS" : "PIM";
    const result = outcome.result;
    const isPush = result === "push";
    const wonLabel = result === "over" ? "OVER " + line : result === "under" ? "UNDER " + line : "PUSH";
    return (
      <div className="border-t border-ink-700/40 bg-gradient-to-r from-ink-900/60 via-ink-850 to-ink-900/60 px-5 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-ink-400">Result</span>
          {isPush ? (
            <span className="rounded-md bg-ink-700 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-ink-300">Push</span>
          ) : (
            <span className="rounded-md bg-brand/15 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-brand">+5 · {wonLabel}</span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">Final Total</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="font-display text-[32px] font-black tabular-nums leading-none text-brand">{totalPim}</span>
              <span className="font-mono text-[10px] uppercase text-ink-400">{totalLabel}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">Line</div>
            <div className="mt-0.5 font-display text-[16px] font-bold tabular-nums text-ink-300">{line}</div>
          </div>
        </div>
      </div>
    );
  }

  if (prop.prop_type === "game_winner") {
    const homeTeam = prop.metadata?.home_team ?? "HOME";
    const awayTeam = prop.metadata?.away_team ?? "AWAY";
    const homeScore = outcome.home_score ?? 0;
    const awayScore = outcome.away_score ?? 0;
    const winnerTeam = outcome.winner_team;
    const isTie = winnerTeam === "tie";
    return (
      <div className="border-t border-ink-700/40 bg-gradient-to-r from-ink-900/60 via-ink-850 to-ink-900/60 px-5 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-ink-400">Final</span>
          {isTie ? (
            <span className="rounded-md bg-ink-700 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-ink-300">Tie</span>
          ) : (
            <span className="rounded-md bg-brand/15 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-brand">{winnerTeam} Wins</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className={cn("flex-1 rounded-md px-2 py-1", winnerTeam === awayTeam ? "" : "bg-rink-red/[0.08] ring-1 ring-rink-red/20")}>
            <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{awayTeam}</div>
            <div className={cn("font-display text-[22px] font-black tabular-nums", winnerTeam === awayTeam ? "text-brand" : "text-ink-400")}>{awayScore}</div>
          </div>
          <span className="font-mono text-[10px] text-ink-600">@</span>
          <div className={cn("flex-1 rounded-md px-2 py-1 text-right", winnerTeam === homeTeam ? "" : "bg-rink-red/[0.08] ring-1 ring-rink-red/20")}>
            <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">{homeTeam}</div>
            <div className={cn("font-display text-[22px] font-black tabular-nums", winnerTeam === homeTeam ? "text-brand" : "text-ink-400")}>{homeScore}</div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function getPropOptions(prop: Prop): { value: string; label: string; subtitle: string }[] {
  switch (prop.prop_type) {
    case "h2h_player":
    case "h2h_goalie":
      return [
        { value: "a", label: prop.metadata?.player_a_name ?? "Player A", subtitle: prop.metadata?.player_a_team ?? "A" },
        { value: "b", label: prop.metadata?.player_b_name ?? "Player B", subtitle: prop.metadata?.player_b_team ?? "B" },
      ];
    case "game_total_pim":
    case "game_total_goals":
      return [
        { value: "over", label: `Over ${prop.metadata?.line ?? "—"}`, subtitle: "O/U" },
        { value: "under", label: `Under ${prop.metadata?.line ?? "—"}`, subtitle: "O/U" },
      ];
    case "game_winner":
      return [
        { value: prop.metadata?.away_team ?? "AWAY", label: prop.metadata?.away_team ?? "Away", subtitle: "AWAY" },
        { value: prop.metadata?.home_team ?? "HOME", label: prop.metadata?.home_team ?? "Home", subtitle: "HOME" },
      ];
    case "next_team_to_score":
      return [
        { value: prop.metadata?.home_team_id ?? "HOME", label: prop.metadata?.home_team_name ?? "Home", subtitle: "HOME" },
        { value: prop.metadata?.away_team_id ?? "AWAY", label: prop.metadata?.away_team_name ?? "Away", subtitle: "AWAY" },
      ];
  }
}
