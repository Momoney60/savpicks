"use client";

import { cn } from "@/lib/utils";

type Prop = {
  id: string;
  prop_type: "h2h_player" | "game_total_pim" | "next_team_to_score";
  metadata: any;
  locks_at: string | null;
  status: string;
};

type PropPick = {
  user_id: string;
  prop_id: string;
  selection: any;
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
  const groups = props.filter((p) => p.prop_type !== "next_team_to_score").reduce((acc, p) => {
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
    switch (prop.prop_type) {
      case "h2h_player":
        return sel === "a"
          ? prop.metadata?.player_a_name ?? "A"
          : prop.metadata?.player_b_name ?? "B";
      case "game_total_pim":
        return sel === "over"
          ? `Over ${prop.metadata?.line}`
          : `Under ${prop.metadata?.line}`;
      case "next_team_to_score":
        return sel === prop.metadata?.home_team_id
          ? prop.metadata?.home_team_name ?? "Home"
          : prop.metadata?.away_team_name ?? "Away";
      default:
        return sel;
    }
  }

  if (gameLabels.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-6 text-center">
        <p className="text-sm text-ink-400">No props yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gameLabels.map((label) => {
        const gameProps = groups[label];
        return (
          <div key={label} className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850">
            <div className="border-b border-ink-700 bg-ink-800/50 px-4 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-300">
                {label}
              </span>
            </div>
            <div className="divide-y divide-ink-700/60">
              {gameProps.map((prop) => {
                const isLocked =
                  prop.status !== "open" ||
                  (!!prop.locks_at && new Date(prop.locks_at) < now);
                const propPicks = picks.filter((p) => p.prop_id === prop.id);
                const propLabel = {
                  h2h_player: `⚔️ ${prop.metadata?.player_a_name} vs ${prop.metadata?.player_b_name}`,
                  game_total_pim: `⏱️ PIMs O/U ${prop.metadata?.line}`,
                  next_team_to_score: "⚡ Next Goal",
                }[prop.prop_type];

                return (
                  <div key={prop.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-ink-100">{propLabel}</span>
                      <span className="text-[10px] text-ink-500">
                        {isLocked ? "🔒 Locked" : `${propPicks.length} bet${propPicks.length === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {propPicks.length === 0 ? (
                        <span className="text-[11px] text-ink-500">No bets yet</span>
                      ) : (
                        propPicks.map((pick) => {
                          const isMe = pick.user_id === currentUserId;
                          const canSee = isMe || isLocked;
                          return (
                            <div
                              key={pick.prop_id + pick.user_id}
                              className="flex items-center justify-between text-[12px]"
                            >
                              <span
                                className={cn(
                                  "truncate",
                                  isMe ? "font-bold text-brand" : "text-ink-300"
                                )}
                              >
                                {userMap[pick.user_id] ?? "?"}
                                {isMe && <span className="ml-1 text-ink-500">(you)</span>}
                              </span>
                              <span
                                className={cn(
                                  "font-semibold",
                                  canSee ? "text-ink-100" : "text-ink-600"
                                )}
                              >
                                {canSee ? selectionLabel(prop, pick.selection) : "🔒"}
                              </span>
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
