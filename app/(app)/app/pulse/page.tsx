import { createClient } from "@/lib/supabase/server";
import LeaderboardSwitcher from "@/components/pulse/LeaderboardSwitcher";
import CollapsibleSection from "@/components/pulse/CollapsibleSection";
import ActivityFeed from "@/components/pulse/ActivityFeed";
import PicksVertical from "@/components/pulse/PicksVertical";
import PropsLog from "@/components/pulse/PropsLog";

export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: bracketLb },
    { data: roundPropsLb },
    { data: activity },
    { data: profile },
    { data: series },
    { data: picks },
    { data: users },
    { data: props },
    { data: propPicks },
  ] = await Promise.all([
    supabase.from("bracket_leaderboard").select("*").order("rank").limit(20),
    supabase.rpc("round_prop_leaderboard", { p_round: 1 }),
    supabase
      .from("activity_events")
      .select("*, profiles(gamertag, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("profiles").select("gamertag, is_paid").eq("id", user!.id).single(),
    supabase
      .from("series")
      .select("id, round, bracket_slot, picks_lock_at, winner_id, team_a:team_a_id(id, short_name, logo_url, primary_color), team_b:team_b_id(id, short_name, logo_url, primary_color)")
      .order("bracket_slot"),
    supabase.from("bracket_picks").select("user_id, series_id, picked_team_id, is_correct, locked_at"),
    supabase.from("profiles").select("id, gamertag").order("gamertag"),
    supabase.from("props").select("*").order("locks_at"),
    supabase.from("prop_picks").select("user_id, prop_id, selection"),
  ]);

  const mappedUsers = (users ?? []).map((u: any) => ({ user_id: u.id, gamertag: u.gamertag }));
  const myBracket = (bracketLb ?? []).find((r: any) => r.user_id === user!.id);
  const myProps = (roundPropsLb ?? []).find((r: any) => r.user_id === user!.id);
  const totalPlayers = mappedUsers.length;
  const picksCount = (picks ?? []).filter((p: any) => p.user_id === user!.id).length;
  const myPropCount = (propPicks ?? []).filter((p: any) => p.user_id === user!.id).length;

  return (
    <main className="mx-auto max-w-md px-4 pt-safe pb-6">
      <header className="flex items-center justify-between pt-4 pb-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">
            Cup Playoffs · R1
          </p>
          <h1 className="mt-0.5 font-display text-[26px] font-black tracking-tight text-ink-100">
            {profile?.gamertag ?? "Picker"}
          </h1>
        </div>
        {!profile?.is_paid && (
          <span className="rounded-full border border-pending/40 bg-pending/10 px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-wider text-pending">
            Unpaid
          </span>
        )}
      </header>

      {/* Hero stats */}
      <div className="mb-5 overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-brand/15 via-ink-850 to-ink-900 p-4">
        <div className="flex items-center justify-between font-mono text-[10px] font-black uppercase tracking-[0.2em]">
          <span className="text-brand">Your Position</span>
          <span className="text-ink-500">{totalPlayers} {totalPlayers === 1 ? "player" : "players"}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-[44px] font-black leading-none tabular-nums text-ink-100">
                {myBracket?.rank ?? "—"}
              </span>
              {myBracket?.rank === 1 && <span className="text-lg">🏆</span>}
            </div>
            <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-400">
              Bracket
            </div>
            <div className="text-[10px] text-ink-500">
              {myBracket?.points ?? 0} pts
              {(myBracket?.max_streak ?? 0) >= 2 && (
                <span className="ml-1 font-bold text-brand">· 🔥 {myBracket.max_streak}×</span>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-[44px] font-black leading-none tabular-nums text-ink-100">
                {myProps?.rank ?? "—"}
              </span>
            </div>
            <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-400">
              R1 Props
            </div>
            <div className="text-[10px] text-ink-500">
              {myProps?.points ?? 0} pts
            </div>
          </div>
        </div>
      </div>

      {/* Unified leaderboard */}
      <div className="mb-3">
        <LeaderboardSwitcher
          bracket={(bracketLb ?? []) as any}
          props={(roundPropsLb ?? []) as any}
          currentUserId={user!.id}
        />
      </div>

      {/* Collapsibles */}
      <div className="mb-3 space-y-3">
        <CollapsibleSection
          title="Round 1 Picks"
          subtitle="Reveals at lock · 8 series"
          count={`${picksCount}/8`}
        >
          <PicksVertical
            series={(series ?? []) as any}
            picks={(picks ?? []) as any}
            users={mappedUsers}
            currentUserId={user!.id}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Prop Bets"
          subtitle="Hidden until lock · grouped by game"
          count={`${myPropCount} placed`}
        >
          <PropsLog
            props={(props ?? []) as any}
            picks={(propPicks ?? []) as any}
            users={mappedUsers}
            currentUserId={user!.id}
          />
        </CollapsibleSection>
      </div>

      {/* Compact feed */}
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.15em] text-ink-300">
            Recent
          </h2>
          <span className="font-mono text-[10px] text-ink-500">Live</span>
        </div>
        <ActivityFeed events={(activity ?? []) as any} />
      </section>
    </main>
  );
}
