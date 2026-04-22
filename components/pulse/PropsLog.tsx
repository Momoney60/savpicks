"use client";

import { cn } from "@/lib/utils";

type Prop = {
  id: string;
  prop_type: "h2h_player" | "h2h_goalie" | "game_total_pim" | "game_total_goals" | "game_winner" | "next_team_to_score";
  metadata: any;
  locks_at: string | null;
  status: string;
  outcome?: any;
};

type PropPick = {
  user_id: string;
  prop_id: string;
  selection: any;
  is_correct?: boolean | null;
  awarded_points?: number;
};

type User = { user_id: string; gamertag: string };

export default function PropsLog({
  props,
  picks,
  users,
  currentUserId,
}: {
  props: Prop[];
  picks: PropPick[];
  users: User[];
  currentUserId: string;
}) {
  const groups = props
    .filter((p) => p.prop_type !== "next_team_to_score")
    .reduce((acc, p) => {
      const label = p.metadata?.game_label ?? "Ungrouped";
      if (!acc[label]) acc[label] = [];
      acc[label].push(p);
      return acc;
    }, {} as Record<string, Prop[]>);

  const gameLabels = Object.keys(groups).sort();
  const now = new Date();
  const userMap = Object.fromEntries(users.map((u) => [u.user_id, u.gamertag]));

  function selectionLabel(prop: Prop, selection: any): string {
    const sel = String(selection);
    if (prop.prop_type === "h2h_player" || prop.prop_type === "h2h_goalie") {
      return sel === "a" ? (prop.metadata?.player_a_name ?? "A") : (prop.metadata?.player_b_name ?? "B");
    }
    if (prop.prop_type === "game_total_pim" || prop.prop_type === "game_total_goals") {
      return sel === "over" ? ("Over " + prop.metadata?.line) : ("Under " + prop.metadata?.line);
    }
    if (prop.prop_type === "game_winner") {
      return sel; // team abbrev
    }
    return sel;
  }

  function winnerLine(prop: Prop): string | null {
    if (!prop.outcome) return null;
    const o = prop.outcome;
    if (prop.prop_type === "h2h_player" || prop.prop_type === "h2h_goalie") {
      const aVal = o.player_a_value ?? o.player_a_pts ?? 0;
      const bVal = o.player_b_value ?? o.player_b_pts ?? 0;
      const unit = o.stat === "saves" ? "sv" : o.stat === "pim" ? "PIM" : "pts";
      if (o.winner === "tie") {
        return "Push · " + prop.metadata?.player_a_name + " " + aVal + " vs " + prop.metadata?.player_b_name + " " + bVal;
      }
      const winnerName = o.winner === "a" ? prop.metadata?.player_a_name : prop.metadata?.player_b_name;
      const loserName = o.winner === "a" ? prop.metadata?.player_b_name : prop.metadata?.player_a_name;
      const wVal = o.winner === "a" ? aVal : bVal;
      const lVal = o.winner === "a" ? bVal : aVal;
      return "🏆 " + winnerName + " " + wVal + " " + unit + " — " + loserName + " " + lVal;
    }
    if (prop.prop_type === "game_total_pim" || prop.prop_type === "game_total_goals") {
      const isGoals = prop.prop_type === "game_total_goals";
      const unit = isGoals ? "GOALS" : "PIM";
      const total = isGoals ? o.total_goals : o.total_pim;
      if (o.result === "push") return "Push · " + total + " " + unit;
      return "🏆 " + String(o.result).toUpperCase() + " · " + total + " " + unit + " total";
    }
    if (prop.prop_type === "game_winner") {
      if (o.winner_team === "tie") return "Push · " + o.home_team + " " + o.home_score + " - " + o.away_team + " " + o.away_score;
      return "🏆 " + o.winner_team + " wins · " + o.away_team + " " + o.away_score + " - " + o.home_team + " " + o.home_score;
    }
    return null;
  }

  if (gameLabels.length === 0) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-6 text-center">
        <p className="text-[12px] text-ink-400">No props yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {gameLabels.map((label) => {
        const gameProps = groups[label];
        return (
          <div key={label} className="overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
            <div className="border-b border-ink-700 bg-ink-800/50 px-3 py-2">
              <span className="font-mono text-[10px] font-black uppercase tracking-widest text-ink-300">{label}</span>
            </div>
            <div className="divide-y divide-ink-700/60">
              {gameProps.map((prop) => {
                const isLocked = prop.status !== "open" || (!!prop.locks_at && new Date(prop.locks_at) < now);
                const isResolved = !!prop.outcome;
                const propPicks = picks.filter((p) => p.prop_id === prop.id);
                const propLabel =
                  prop.prop_type === "h2h_player"
                    ? "⚔️ " + prop.metadata?.player_a_name + " vs " + prop.metadata?.player_b_name
                    : prop.prop_type === "h2h_goalie"
                    ? "🥅 " + prop.metadata?.player_a_name + " vs " + prop.metadata?.player_b_name
                    : prop.prop_type === "game_total_pim"
                    ? "⏱️ PIMs O/U " + prop.metadata?.line
                    : prop.prop_type === "game_total_goals"
                    ? "🎯 Goals O/U " + prop.metadata?.line
                    : prop.prop_type === "game_winner"
                    ? "🏒 Game Winner"
                    : "⚡ Next Goal";
                const winLine = winnerLine(prop);

                return (
                  <div key={prop.id} className="px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[12px] font-bold text-ink-100">{propLabel}</span>
                      <span className="font-mono text-[9px] uppercase text-ink-500">{isLocked ? "🔒" : propPicks.length}</span>
                    </div>
                    {winLine && (
                      <div className="mt-1 rounded-md bg-brand/10 px-2 py-1 font-mono text-[10px] font-bold text-brand">
                        {winLine}
                      </div>
                    )}
                    <div className="mt-1.5 space-y-0.5">
                      {propPicks.length === 0 ? (
                        <span className="text-[10px] text-ink-500">No bets</span>
                      ) : (
                        propPicks.map((pick) => {
                          const isMe = pick.user_id === currentUserId;
                          const canSee = isMe || isLocked;
                          const resultIcon = isResolved && pick.is_correct === true
                            ? "✓"
                            : isResolved && pick.is_correct === false
                            ? "✗"
                            : null;
                          return (
                            <div key={pick.prop_id + pick.user_id} className="flex items-center justify-between text-[11px]">
                              <span className={cn("truncate", isMe ? "font-bold text-brand" : "text-ink-400")}>
                                {userMap[pick.user_id] ?? "?"}
                                {isMe && <span className="ml-1 text-[9px] text-brand/60">(you)</span>}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={cn(canSee ? "text-ink-200" : "text-ink-600")}>
                                  {canSee ? selectionLabel(prop, pick.selection) : "🔒"}
                                </span>
                                {resultIcon && (
                                  <span className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded font-mono text-[11px] font-black px-1", pick.is_correct ? "bg-brand/15 text-brand" : "bg-rink-red/20 text-rink-red")}>
                                    {resultIcon}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
