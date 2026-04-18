"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn, haptic } from "@/lib/utils";
import NtsConfirmSheet from "./NtsConfirmSheet";

type Team = {
  id: string;
  short_name: string;
  primary_color: string | null;
  logo_url: string | null;
  is_eliminated: boolean;
};

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
  const propTeams = [
    m.home_team,
    m.away_team,
    m.home_team_id,
    m.away_team_id,
    m.player_a_team,
    m.player_b_team,
  ].filter(Boolean);
  return Array.from(gameTeams).every((t) => propTeams.includes(t));
}

export default function LiveView({
  games,
  props,
  myPicks,
  allPropPicks = [],
  users = [],
  currentUserId,
}: {
  games: Game[];
  props: Prop[];
  myPicks: PropPick[];
  allPropPicks?: PropPick[];
  users?: PublicUser[];
  currentUserId?: string;
}) {
  const orderedGames = [...games].sort((a, b) => {
    const rank = (g: Game) => (g.status === "live" ? 0 : g.status === "scheduled" ? 1 : 2);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });

  const orphanProps = props.filter((p) => !games.some((g) => propMatchesGame(p, g)));

  if (orderedGames.length === 0 && orphanProps.length === 0) {
    return (
      <div className="rounded-3xl border border-ink-700/70 bg-ink-850 p-10 text-center">
        <div className="text-5xl opacity-60">🏒</div>
        <p className="mt-4 font-display text-lg font-bold">No games today</p>
        <p className="mt-1 text-sm text-ink-400">Check back when the puck drops.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orderedGames.map((game) => {
        const gameProps = props.filter((p) => propMatchesGame(p, game));
        return (
          <GameCell
            key={game.id}
            game={game}
            props={gameProps}
            myPicks={myPicks}
            allPropPicks={allPropPicks}
            users={users}
            currentUserId={currentUserId}
          />
        );
      })}

      {orphanProps.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-ink-700/70 bg-ink-850">
          <div className="border-b border-ink-700/50 bg-ink-900/60 px-5 py-2.5">
            <span className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-ink-400">
              Other markets
            </span>
          </div>
          <div className="divide-y divide-ink-700/40">
            {orphanProps.map((p) => (
              <PropRow key={p.id} prop={p} existingPick={myPicks.find((m) => m.prop_id === p.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GameCell({
  game,
  props,
  myPicks,
  allPropPicks,
  users,
  currentUserId,
}: {
  game: Game;
  props: Prop[];
  myPicks: PropPick[];
  allPropPicks: PropPick[];
  users: PublicUser[];
  currentUserId?: string;
}) {
  const isLive = game.status === "live";
  const isFinal = game.status === "final";
  const isScheduled = game.status === "scheduled";
  const away = game.away_team;
  const home = game.home_team;
  const winningHome = game.home_score > game.away_score;
  const winningAway = game.away_score > game.home_score;

  const ntsProps = props.filter(
    (p) => p.prop_type === "next_team_to_score" && p.status === "open"
  );

  return (
    <motion.div
      layout
      className={cn(
        "overflow-hidden rounded-3xl border bg-ink-850 shadow-lg",
        isLive ? "border-live/30 shadow-live/10" : "border-ink-700/70"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-5 py-2.5",
          isLive ? "bg-gradient-to-r from-live/10 via-ink-900/40 to-transparent" : "bg-ink-900/60",
          "border-b border-ink-700/50"
        )}
      >
        {isLive ? (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
            </span>
            <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-live">
              Live
            </span>
            {game.period && (
              <>
                <span className="text-ink-600">·</span>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-ink-200">
                  {game.period}
                  {game.clock ? ` ${game.clock}` : ""}
                </span>
              </>
            )}
          </div>
        ) : isFinal ? (
          <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-ink-300">
            Final
          </span>
        ) : (
          <CountdownPill target={game.scheduled_at} />
        )}
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
          {new Date(game.scheduled_at).toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <div className="px-5 py-4">
        <TeamLine
          team={away}
          score={game.away_score}
          live={isLive}
          winning={winningAway && (isLive || isFinal)}
          final={isFinal}
          scheduled={isScheduled}
        />
        <div className="my-3 h-px bg-ink-700/40" />
        <TeamLine
          team={home}
          score={game.home_score}
          live={isLive}
          winning={winningHome && (isLive || isFinal)}
          final={isFinal}
          scheduled={isScheduled}
        />
      </div>

      {props.length > 0 && (
        <>
          <div className="flex items-center justify-between border-t border-ink-700/50 bg-ink-900/40 px-5 py-2.5">
            <span className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-ink-300">
              Markets
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
              {props.length} {props.length === 1 ? "market" : "markets"}
            </span>
          </div>
          <div className="divide-y divide-ink-700/40">
            {props
              .sort((a, b) => PROP_ORDER[a.prop_type] - PROP_ORDER[b.prop_type])
              .map((p) => (
                <PropRow key={p.id} prop={p} existingPick={myPicks.find((m) => m.prop_id === p.id)} />
              ))}
          </div>
        </>
      )}

      {ntsProps.length > 0 && users.length > 0 && (
        <NextGoalPicksStrip
          ntsProps={ntsProps}
          allPropPicks={allPropPicks}
          users={users}
          currentUserId={currentUserId}
          game={game}
        />
      )}
    </motion.div>
  );
}

function NextGoalPicksStrip({
  ntsProps,
  allPropPicks,
  users,
  currentUserId,
  game,
}: {
  ntsProps: Prop[];
  allPropPicks: PropPick[];
  users: PublicUser[];
  currentUserId?: string;
  game: Game;
}) {
  const propIds = new Set(ntsProps.map((p) => p.id));
  const relevantPicks = allPropPicks.filter((p) => propIds.has(p.prop_id));
  if (relevantPicks.length === 0) return null;

  const userMap = Object.fromEntries(users.map((u) => [u.user_id, u.gamertag]));
  const byTeam: Record<string, string[]> = {};
  relevantPicks.forEach((p) => {
    if (!p.user_id) return;
    const sel = String(p.selection);
    if (!byTeam[sel]) byTeam[sel] = [];
    byTeam[sel].push(p.user_id);
  });

  const homeId = game.home_team_id;
  const awayId = game.away_team_id;
  const homeName = game.home_team?.short_name ?? homeId;
  const awayName = game.away_team?.short_name ?? awayId;

  return (
    <div className="border-t border-ink-700/50 bg-ink-900/30 px-5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <TeamPickGroup
          teamId={awayId}
          teamName={awayName}
          userIds={byTeam[awayId] ?? []}
          userMap={userMap}
          currentUserId={currentUserId}
          logoUrl={game.away_team?.logo_url}
        />
        <TeamPickGroup
          teamId={homeId}
          teamName={homeName}
          userIds={byTeam[homeId] ?? []}
          userMap={userMap}
          currentUserId={currentUserId}
          logoUrl={game.home_team?.logo_url}
          alignRight
        />
      </div>
    </div>
  );
}

function TeamPickGroup({
  teamId,
  teamName,
  userIds,
  userMap,
  currentUserId,
  logoUrl,
  alignRight,
}: {
  teamId: string;
  teamName: string;
  userIds: string[];
  userMap: Record<string, string>;
  currentUserId?: string;
  logoUrl?: string | null;
  alignRight?: boolean;
}) {
  const shown = userIds.slice(0, 5);
  const more = userIds.length - shown.length;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        alignRight && "flex-row-reverse"
      )}
    >
      {logoUrl && <img src={logoUrl} alt="" className="h-4 w-4 flex-none object-contain opacity-80" />}
      <div className={cn("flex min-w-0 items-center gap-1.5", alignRight && "flex-row-reverse")}>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-500">
          {teamId}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-ink-400">
          {userIds.length}
        </span>
        {userIds.length > 0 && (
          <div
            className={cn(
              "flex items-center",
              alignRight ? "-space-x-1.5 flex-row-reverse" : "-space-x-1.5"
            )}
          >
            {shown.map((uid, i) => {
              const isMe = uid === currentUserId;
              const initial = (userMap[uid] ?? "?").charAt(0).toUpperCase();
              return (
                <div
                  key={uid}
                  title={userMap[uid]}
                  style={{ zIndex: 5 - i }}
                  className={cn(
                    "flex h-5 w-5 flex-none items-center justify-center rounded-full ring-[1.5px] text-[9px] font-black",
                    isMe
                      ? "bg-brand text-ink-900 ring-ink-850"
                      : "bg-ink-700 text-ink-200 ring-ink-850"
                  )}
                >
                  {initial}
                </div>
              );
            })}
            {more > 0 && (
              <div className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-ink-800 text-[9px] font-black text-ink-400 ring-[1.5px] ring-ink-850">
                +{more}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const PROP_ORDER: Record<string, number> = {
  next_team_to_score: 0,
  h2h_player: 1,
  game_total_pim: 2,
};

function TeamLine({
  team,
  score,
  live,
  winning,
  final,
  scheduled,
}: {
  team: Team | null | undefined;
  score: number;
  live: boolean;
  winning: boolean;
  final: boolean;
  scheduled: boolean;
}) {
  if (!team) return <div className="h-10" />;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt=""
            className={cn("h-11 w-11 flex-none object-contain", team.is_eliminated && "opacity-30 grayscale")}
          />
        ) : (
          <div className="h-11 w-11 flex-none rounded-full bg-ink-700" />
        )}
        <div className="min-w-0">
          <div
            className={cn(
              "font-display text-[17px] font-bold leading-tight tracking-tight text-ink-100",
              team.is_eliminated && "text-ink-500 line-through"
            )}
          >
            {team.short_name}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{team.id}</div>
        </div>
      </div>
      {scheduled ? (
        <span className="font-mono text-3xl font-light tabular-nums text-ink-700">—</span>
      ) : (
        <span
          className={cn(
            "font-display text-[38px] font-black leading-none tabular-nums",
            winning ? "text-ink-100" : live ? "text-ink-300" : "text-ink-400",
            final && !winning && "text-ink-600"
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function CountdownPill({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(i);
  }, []);
  const diff = new Date(target).getTime() - now;
  const label =
    diff <= 0
      ? "ABOUT TO START"
      : diff < 60 * 60 * 1000
      ? `STARTS IN ${Math.ceil(diff / 60000)}M`
      : `${new Date(target).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} PUCK DROP`;
  return (
    <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-ink-300">
      {label}
    </span>
  );
}

function PropRow({ prop, existingPick }: { prop: Prop; existingPick?: PropPick }) {
  const [selection, setSelection] = useState<string | null>(
    existingPick ? String(existingPick.selection) : null
  );
  const [pendingNts, setPendingNts] = useState<{ value: string; label: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const locked = prop.status !== "open";
  const isNts = prop.prop_type === "next_team_to_score";
  const ntsLocked = isNts && selection !== null;
  const options = getPropOptions(prop);
  const label = {
    h2h_player: "Grudge Match",
    game_total_pim: "Penalty Minutes",
    next_team_to_score: "Next Goal",
  }[prop.prop_type];
  const sub = {
    h2h_player: `${prop.metadata?.player_a_name} vs ${prop.metadata?.player_b_name}`,
    game_total_pim: `Line · ${prop.metadata?.line ?? "—"}`,
    next_team_to_score: "Who scores next?",
  }[prop.prop_type];

  async function savePick(val: string) {
    const res = await fetch("/api/picks/prop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prop_id: prop.id, selection: val }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSelection(null);
      setErrorMsg(data?.error ?? "Failed");
      haptic("heavy");
      setTimeout(() => setErrorMsg(null), 3500);
      return;
    }
    setSelection(val);
  }

  function handleTap(val: string, label: string) {
    if (locked) return;
    if (ntsLocked) return;
    if (isNts) {
      haptic("light");
      setPendingNts({ value: val, label });
      return;
    }
    haptic("medium");
    setSelection(val);
    savePick(val);
  }

  return (
    <div className="px-5 py-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-display text-[13px] font-bold leading-tight text-ink-100">{label}</div>
          <div className="mt-0.5 truncate text-[11px] text-ink-400">{sub}</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
              locked || ntsLocked ? "bg-ink-800 text-ink-500" : "bg-brand/10 text-brand"
            )}
          >
            +{prop.points_reward}
          </span>
          {(locked || ntsLocked) && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">🔒</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const picked = selection === opt.value;
          const disabled = locked || (ntsLocked && !picked);
          return (
            <button
              key={opt.value}
              onClick={() => handleTap(opt.value, opt.label)}
              disabled={disabled}
              className={cn(
                "relative flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition",
                picked ? "border-brand bg-brand/10" : "border-ink-700 bg-ink-900/60",
                !disabled && !picked && "active:scale-[0.98] active:bg-ink-800",
                disabled && !picked && "cursor-not-allowed opacity-40",
                ntsLocked && picked && "cursor-default"
              )}
            >
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">
                {opt.subtitle}
              </span>
              <span className={cn("font-display text-[13px] font-bold", picked ? "text-brand" : "text-ink-100")}>
                {opt.label}
              </span>
              {picked && (
                <span className="absolute right-2 top-2 font-mono text-[9px] font-black uppercase text-brand">
                  {ntsLocked ? "LOCKED" : "✓"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {errorMsg && (
        <div className="mt-2 rounded-lg border border-loss/40 bg-loss/10 px-3 py-1.5 text-[11px] font-semibold text-loss">
          {errorMsg}
        </div>
      )}
      <NtsConfirmSheet
        open={!!pendingNts}
        teamId={pendingNts?.value ?? ""}
        teamName={pendingNts?.label ?? ""}
        onConfirm={() => {
          if (!pendingNts) return;
          setSelection(pendingNts.value);
          savePick(pendingNts.value);
          setPendingNts(null);
        }}
        onCancel={() => setPendingNts(null)}
      />
    </div>
  );
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
