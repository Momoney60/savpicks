"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
  prop_type: "h2h_player" | "game_total_pim" | "next_team_to_score";
  status: "open" | "locked" | "resolved" | "void";
  points_reward: number;
  locks_at: string | null;
  metadata: any;
};

type PropPick = { id?: string; user_id?: string; prop_id: string; selection: any };
type PublicUser = { user_id: string; gamertag: string };

function propMatchesGame(prop: Prop, game: Game): boolean {
  const m = prop.metadata ?? {};
  const gameTeams = new Set([game.home_team_id, game.away_team_id]);
  const propTeams = [m.home_team, m.away_team, m.home_team_id, m.away_team_id, m.player_a_team, m.player_b_team].filter(Boolean);
  return Array.from(gameTeams).every((t) => propTeams.includes(t));
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
  const isLive = game.status === "live";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";
  const showStats = (isLive || isFinal) && (game.player_stats?.length ?? 0) > 0;
  const [collapsed, setCollapsed] = useState<boolean>(isFinal);

  return (
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
                    {!isScheduled && <PickerStrip prop={p} allPropPicks={allPropPicks} users={users} currentUserId={currentUserId} game={game} />}
                    <PropResultBanner prop={p} game={game} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}

function LiveStatsPanel({ game, props }: { game: Game; props: Prop[] }) {
  const h2hProp = props.find((p) => p.prop_type === "h2h_player");
  const pimProp = props.find((p) => p.prop_type === "game_total_pim");
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

  if (!h2hProp && !pimProp) return null;

  const totalPim = game.total_pim ?? 0;
  const line = pimProp ? parseFloat(pimProp.metadata?.line ?? "0") : 0;
  const pimHighlight = pimProp && totalPim > line;

  return (
    <div className="border-t border-ink-700/50 bg-ink-900/40 px-5 py-3">
      <div className="flex items-stretch gap-4">
        {pimProp && (
          <div className="flex-1 border-r border-ink-700/40 pr-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">
              Line {line}
            </div>
            <div className="font-display text-[11px] font-bold text-ink-200">Total PIM</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className={cn("font-display text-[24px] font-black tabular-nums leading-none", pimHighlight ? "text-brand" : "text-ink-100")}>
                {totalPim}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">min</span>
            </div>
          </div>
        )}

        {h2hProp && (
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">
              Grudge · H2H
            </div>
            <div className="mt-0.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[9px] font-bold tracking-wider text-ink-500">
                    {playerA?.team ?? h2hProp.metadata?.player_a_team ?? ""}
                  </span>
                  <span className={cn("truncate font-display text-[12px] font-bold", (playerA?.points ?? 0) > (playerB?.points ?? 0) ? "text-brand" : "text-ink-200")}>
                    {lastName(h2hProp.metadata?.player_a_name ?? "")}
                  </span>
                </div>
                <span className={cn("font-display text-[15px] font-black tabular-nums", (playerA?.points ?? 0) > (playerB?.points ?? 0) ? "text-brand" : "text-ink-300")}>
                  {playerA?.points ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[9px] font-bold tracking-wider text-ink-500">
                    {playerB?.team ?? h2hProp.metadata?.player_b_team ?? ""}
                  </span>
                  <span className={cn("truncate font-display text-[12px] font-bold", (playerB?.points ?? 0) > (playerA?.points ?? 0) ? "text-brand" : "text-ink-200")}>
                    {lastName(h2hProp.metadata?.player_b_name ?? "")}
                  </span>
                </div>
                <span className={cn("font-display text-[15px] font-black tabular-nums", (playerB?.points ?? 0) > (playerA?.points ?? 0) ? "text-brand" : "text-ink-300")}>
                  {playerB?.points ?? 0}
                </span>
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

function PickerStrip({ prop, allPropPicks, users, currentUserId, game }: { prop: Prop; allPropPicks: PropPick[]; users: PublicUser[]; currentUserId?: string; game: Game; }) {
  const propPicks = allPropPicks.filter((p) => p.prop_id === prop.id && p.user_id);
  if (propPicks.length === 0 || users.length === 0) return null;
  const userMap = Object.fromEntries(users.map((u) => [u.user_id, u.gamertag]));

  // Group picks by selection
  const bySel: Record<string, string[]> = {};
  propPicks.forEach((p) => {
    const sel = String(p.selection);
    if (!bySel[sel]) bySel[sel] = [];
    bySel[sel].push(p.user_id!);
  });

  // Get the two side labels for this prop
  const opts = getPropOptions(prop);

  return (
    <div className="border-t border-ink-700/30 bg-ink-900/20 px-5 py-2">
      <div className="flex items-center justify-between gap-3">
        {opts.map((opt) => {
          const userIds = bySel[opt.value] ?? [];
          const shown = userIds.slice(0, 6);
          const more = userIds.length - shown.length;
          const sideLabel = opt.subtitle === "O/U" ? opt.label : opt.subtitle;
          return (
            <div key={opt.value} className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">{sideLabel}</span>
              <div className="flex flex-wrap items-center gap-1">
                {shown.map((uid) => {
                  const isMe = uid === currentUserId;
                  const name = userMap[uid] ?? "?";
                  const tag = name.slice(0, 3).toUpperCase();
                  return (
                    <span key={uid} title={name} className={cn("rounded-md px-1.5 py-0.5 font-mono text-[9px] font-black tracking-wider", isMe ? "bg-brand text-ink-900" : "bg-ink-700 text-ink-200")}>
                      {tag}
                    </span>
                  );
                })}
                {more > 0 && (
                  <span className="rounded-md bg-ink-800 px-1.5 py-0.5 font-mono text-[9px] font-black tracking-wider text-ink-400">+{more}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PROP_ORDER: Record<string, number> = { next_team_to_score: 0, h2h_player: 1, game_total_pim: 2 };

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
  const label = { h2h_player: "Grudge Match", game_total_pim: "Penalty Minutes", next_team_to_score: "Next Goal" }[prop.prop_type];
  const sub = { h2h_player: `${prop.metadata?.player_a_name} vs ${prop.metadata?.player_b_name}`, game_total_pim: `Line · ${prop.metadata?.line ?? "—"}`, next_team_to_score: "Who scores next?" }[prop.prop_type];

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

  if (prop.prop_type === "h2h_player") {
    const aName = prop.metadata?.player_a_name ?? "A";
    const bName = prop.metadata?.player_b_name ?? "B";
    const aTeam = prop.metadata?.player_a_team ?? "";
    const bTeam = prop.metadata?.player_b_team ?? "";
    const aPts = outcome.player_a_pts ?? 0;
    const bPts = outcome.player_b_pts ?? 0;
    const winner = outcome.winner;
    const isTie = winner === "tie";

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
              <span className="font-mono text-[9px] uppercase text-ink-500">pts</span>
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
              <span className="font-mono text-[9px] uppercase text-ink-500">pts</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (prop.prop_type === "game_total_pim") {
    const line = parseFloat(prop.metadata?.line ?? "0");
    const totalPim = outcome.total_pim ?? game.total_pim ?? 0;
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
              <span className="font-mono text-[10px] uppercase text-ink-400">PIM</span>
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
  return null;
}

function getPropOptions(prop: Prop): { value: string; label: string; subtitle: string }[] {
  switch (prop.prop_type) {
    case "h2h_player":
      return [
        { value: "a", label: prop.metadata?.player_a_name ?? "Player A", subtitle: prop.metadata?.player_a_team ?? "A" },
        { value: "b", label: prop.metadata?.player_b_name ?? "Player B", subtitle: prop.metadata?.player_b_team ?? "B" },
      ];
    case "game_total_pim":
      return [
        { value: "over", label: `Over ${prop.metadata?.line ?? "—"}`, subtitle: "O/U" },
        { value: "under", label: `Under ${prop.metadata?.line ?? "—"}`, subtitle: "O/U" },
      ];
    case "next_team_to_score":
      return [
        { value: prop.metadata?.home_team_id ?? "HOME", label: prop.metadata?.home_team_name ?? "Home", subtitle: "HOME" },
        { value: prop.metadata?.away_team_id ?? "AWAY", label: prop.metadata?.away_team_name ?? "Away", subtitle: "AWAY" },
      ];
  }
}
