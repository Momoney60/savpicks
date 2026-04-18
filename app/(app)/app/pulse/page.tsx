import { createClient } from "@/lib/supabase/server";
import LeaderboardTable from "@/components/pulse/LeaderboardTable";
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
      .limit(20),
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

  return (
    <main className="mx-auto max-w-md px-4 pt-safe">
      <header className="flex items-center justify-between pt-4 pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            Cup Playoffs · Round 1
          </p>
          <h1 className="mt-0.5 font-display text-[28px] font-black tracking-tight text-ink-100">
            {profile?.gamertag ?? "Picker"}
          </h1>
        </div>
        {!profile?.is_paid && (
          <span className="rounded-full border border-pending/40 bg-pending/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-pending">
            Unpaid
          </span>
        )}
      </header>

      {/* Hero stats card */}
      <div className="mb-6 overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-brand/15 via-ink-850 to-ink-900 p-5 shadow-lg shadow-brand/5">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em]">
          <span className="text-brand">Your Position</span>
          <span className="text-ink-500">{totalPlayers} {totalPlayers === 1 ? "player" : "players"}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl font-black leading-none tabular-nums text-ink-100">
                {myBracket?.rank ?? "—"}
              </span>
              {myBracket?.rank === 1 && (
                <span className="text-xl">🏆</span>
              )}
            </div>
            <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Bracket
            </div>
            <div className="text-[11px] text-ink-500">
              {myBracket?.points ?? 0} pts
              {(myBracket?.max_streak ?? 0) >= 2 && (
                <span className="ml-1 font-bold text-brand">· 🔥 {myBracket.max_streak}×</span>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl font-black leading-none tabular-nums text-ink-100">
                {myProps?.rank ?? "—"}
              </span>
            </div>
            <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              R1 Props
            </div>
            <div className="text-[11px] text-ink-500">
              {myProps?.points ?? 0} pts
            </div>
          </div>
        </div>
      </div>

      <section className="mb-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-[22px] font-black tracking-tight">Bracket</h2>
            <p className="text-[11px] text-ink-400">Main pot · winner takes all</p>
          </div>
        </div>
        <LeaderboardTable rows={(bracketLb ?? []) as any} unit="pts" />
      </section>

      <section className="mb-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-[22px] font-black tracking-tight">Round 1 Props</h2>
            <p className="text-[11px] text-ink-400">$100 to round leader</p>
          </div>
        </div>
        <LeaderboardTable rows={(roundPropsLb ?? []) as any} unit="pts" />
      </section>

      <section className="mb-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-[22px] font-black tracking-tight">Round 1 Picks</h2>
            <p className="text-[11px] text-ink-400">Reveals at lock · 8 series</p>
          </div>
        </div>
        <PicksVertical
          series={(series ?? []) as any}
          picks={(picks ?? []) as any}
          users={mappedUsers}
          currentUserId={user!.id}
        />
      </section>

      <section className="mb-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-[22px] font-black tracking-tight">Prop Bets</h2>
            <p className="text-[11px] text-ink-400">Hidden until lock · grouped by game</p>
          </div>
        </div>
        <PropsLog
          props={(props ?? []) as any}
          picks={(propPicks ?? []) as any}
          users={mappedUsers}
          currentUserId={user!.id}
        />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-[22px] font-black tracking-tight">Feed</h2>
            <p className="text-[11px] text-ink-400">Live activity</p>
          </div>
        </div>
        <ActivityFeed events={(activity ?? []) as any} />
      </section>
    </main>
  );
}
