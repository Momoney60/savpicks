import { createClient } from "@/lib/supabase/server";
import LeaderboardTable from "@/components/pulse/LeaderboardTable";
import ActivityFeed from "@/components/pulse/ActivityFeed";
import PicksMatrix from "@/components/pulse/PicksMatrix";

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
  ] = await Promise.all([
    supabase.from("bracket_leaderboard").select("*").order("rank").limit(20),
    supabase.rpc("round_prop_leaderboard", { p_round: 1 }),
    supabase
      .from("activity_events")
      .select("*, profiles(gamertag, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("profiles").select("gamertag, is_paid").eq("id", user!.id).single(),
    supabase
      .from("series")
      .select("id, round, bracket_slot, picks_lock_at, winner_id, team_a:team_a_id(id, short_name, logo_url, primary_color), team_b:team_b_id(id, short_name, logo_url, primary_color)")
      .order("bracket_slot"),
    supabase.from("bracket_picks").select("user_id, series_id, picked_team_id, is_correct, locked_at"),
    supabase.from("profiles").select("id, gamertag").order("gamertag"),
  ]);

  const mappedUsers = (users ?? []).map((u: any) => ({ user_id: u.id, gamertag: u.gamertag }));

  return (
    <main className="mx-auto max-w-md px-4 pt-safe">
      <header className="flex items-center justify-between pt-4 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">Welcome back</p>
          <h1 className="font-display text-2xl font-black tracking-tight">{profile?.gamertag ?? "Picker"}</h1>
        </div>
        {!profile?.is_paid && (
          <span className="rounded-full border border-pending/30 bg-pending/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-pending">
            Unpaid
          </span>
        )}
      </header>

      <section className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-black tracking-tight">Bracket Leaderboard</h2>
          <span className="text-[10px] text-ink-400">Winner takes main pot</span>
        </div>
        <LeaderboardTable rows={(bracketLb ?? []) as any} unit="pts" />
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-black tracking-tight">Round 1 Props</h2>
          <span className="text-[10px] text-ink-400">$100 to round winner</span>
        </div>
        <LeaderboardTable rows={(roundPropsLb ?? []) as any} unit="pts" />
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-black tracking-tight">Round 1 Picks</h2>
          <span className="text-[10px] text-ink-400">Reveals at lock</span>
        </div>
        <PicksMatrix
          series={(series ?? []) as any}
          picks={(picks ?? []) as any}
          users={mappedUsers}
          currentUserId={user!.id}
        />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-black tracking-tight">Feed</h2>
          <span className="text-[10px] text-ink-400">Live</span>
        </div>
        <ActivityFeed events={(activity ?? []) as any} />
      </section>
    </main>
  );
}
