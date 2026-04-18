"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn, haptic } from "@/lib/utils";

type Team = {
  id: string;
  short_name: string;
  primary_color: string | null;
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

type PropPick = {
  id: string;
  prop_id: string;
  selection: any;
};

export default function LiveView({
  games,
  props,
  myPicks,
}: {
  games: Game[];
  props: Prop[];
  myPicks: PropPick[];
}) {
  const liveGames = games.filter((g) => g.status === "live");
  const upcomingGames = games.filter((g) => g.status === "scheduled").slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Live games */}
      {liveGames.length > 0 && (
        <section>
          <SectionHeader title="Live now" count={liveGames.length} hot />
          <div className="space-y-2">
            {liveGames.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}

      {/* Open props */}
      {props.length > 0 && (
        <section>
          <SectionHeader title="Markets open" count={props.length} />
          <div className="space-y-2">
            {props.map((p) => (
              <PropCard
                key={p.id}
                prop={p}
                existingPick={myPicks.find((pick) => pick.prop_id === p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming games */}
      {upcomingGames.length > 0 && (
        <section>
          <SectionHeader title="Up next" count={upcomingGames.length} />
          <div className="space-y-2">
            {upcomingGames.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}

      {liveGames.length === 0 && props.length === 0 && upcomingGames.length === 0 && (
        <div className="rounded-2xl border border-ink-700 bg-ink-850 p-8 text-center">
          <div className="text-5xl">😴</div>
          <p className="mt-4 font-display text-lg font-bold">No games tonight</p>
          <p className="mt-1 text-sm text-ink-400">
            Check back when the puck drops.
          </p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  hot,
}: {
  title: string;
  count: number;
  hot?: boolean;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className={cn("font-display text-xl font-black tracking-tight", hot && "text-live")}>
        {title}
      </h2>
      <span className="text-[11px] text-ink-400">{count}</span>
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const isLive = game.status === "live";
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-live">
            <span className="h-1.5 w-1.5 rounded-full bg-live live-dot" />
            {game.period ?? "—"} · {game.clock ?? ""}
          </span>
        ) : (
          <span className="text-ink-500">
            {new Date(game.scheduled_at).toLocaleString([], {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <TeamRow team={game.away_team} score={game.away_score} highlight={isLive} />
        <TeamRow team={game.home_team} score={game.home_score} highlight={isLive} />
      </div>
    </div>
  );
}

function TeamRow({
  team,
  score,
  highlight,
}: {
  team: Team | null | undefined;
  score: number;
  highlight: boolean;
}) {
  if (!team) return <div />;
  return (
    <div className="flex items-center justify-between">
      <span
        className={cn("font-display text-[15px] font-bold", team.is_eliminated && "text-ink-500 line-through")}
        style={!team.is_eliminated ? { color: team.primary_color ?? undefined } : undefined}
      >
        {team.short_name}
      </span>
      <span className={cn("font-display text-2xl font-black tabular-nums", highlight ? "text-ink-100" : "text-ink-400")}>
        {score}
      </span>
    </div>
  );
}

function PropCard({ prop, existingPick }: { prop: Prop; existingPick?: PropPick }) {
  const [selection, setSelection] = useState<string | null>(
    existingPick ? String(existingPick.selection) : null
  );
  const locked = prop.status !== "open";

  async function pick(val: string) {
    if (locked) return;
    haptic("medium");
    setSelection(val);
    await fetch("/api/picks/prop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prop_id: prop.id, selection: val }),
    });
  }

  const label = {
    h2h_player: "Grudge Match",
    game_total_pim: "Penalty Total",
    next_team_to_score: "Next Goal",
  }[prop.prop_type];

  const options = getPropOptions(prop);

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 shadow-card"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">
          {label}
        </span>
        <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-black text-brand">
          +{prop.points_reward} PTS
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-ink-700">
        {options.map((opt) => {
          const picked = selection === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => pick(opt.value)}
              disabled={locked}
              className={cn(
                "flex flex-col items-start bg-ink-850 px-4 py-4 text-left transition",
                picked && "bg-brand/10 ring-1 ring-inset ring-brand",
                !locked && !picked && "active:bg-ink-800"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                {opt.subtitle}
              </span>
              <span className="mt-1 font-display text-[15px] font-bold">{opt.label}</span>
              {picked && (
                <span className="mt-1 text-[10px] font-bold text-brand">YOUR PICK</span>
              )}
            </button>
          );
        })}
      </div>

      {prop.locks_at && (
        <div className="border-t border-ink-700 px-4 py-2.5 text-center">
          <span className="text-[11px] text-ink-500">
            {locked ? "🔒 Locked" : `Locks ${new Date(prop.locks_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function getPropOptions(prop: Prop): { value: string; label: string; subtitle: string }[] {
  switch (prop.prop_type) {
    case "h2h_player":
      return [
        { value: "a", label: prop.metadata?.player_a_name ?? "Player A", subtitle: "OVER" },
        { value: "b", label: prop.metadata?.player_b_name ?? "Player B", subtitle: "VS" },
      ];
    case "game_total_pim":
      return [
        { value: "over", label: `Over ${prop.metadata?.line ?? "—"}`, subtitle: "PIMs" },
        { value: "under", label: `Under ${prop.metadata?.line ?? "—"}`, subtitle: "PIMs" },
      ];
    case "next_team_to_score":
      return [
        { value: prop.metadata?.home_team_id ?? "HOME", label: prop.metadata?.home_team_name ?? "Home", subtitle: "NEXT" },
        { value: prop.metadata?.away_team_id ?? "AWAY", label: prop.metadata?.away_team_name ?? "Away", subtitle: "NEXT" },
      ];
  }
}
