import { createClient } from "@/lib/supabase/server";
import LeaderboardSwitcher from "@/components/pulse/LeaderboardSwitcher";
import ActivityFeed from "@/components/pulse/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: bracketLb },
    { data: roundPropsLbR1 },
    { data: roundPropsLbR2 },
    { data: activity },
    { data: profile },
    { data: series },
    { data: allBracketPicks },
    { data: users },
    { data: props },
  ] = await Promise.all([
    supabase.from("bracket_leaderboard").select("*").order("rank").limit(100),
    supabase.rpc("round_prop_leaderboard", { p_round: 1 }),
    supabase.rpc("round_prop_leaderboard", { p_round: 2 }),
    supabase
      .from("activity_events")
      .select("*, profiles(gamertag, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("profiles").select("gamertag, is_paid").eq("id", user!.id).single(),
    supabase
      .from("series")
      .select("*, team_a:team_a_id(*), team_b:team_b_id(*), winner:winner_id(*)")
      .order("round")
      .order("bracket_slot"),
    supabase.from("bracket_picks").select("user_id, series_id, picked_team_id"),
    supabase.from("profiles").select("id, gamertag").order("gamertag"),
    supabase.from("props").select("status, locks_at"),
  ]);

  // Paginated prop_picks fetch (Supabase default cap is 1000)
  const propPicks: any[] = [];
  {
    let pageFrom = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page } = await supabase
        .from("prop_picks")
        .select("user_id, prop_id, is_correct, awarded_points")
        .range(pageFrom, pageFrom + pageSize - 1);
      if (!page || page.length === 0) break;
      propPicks.push(...page);
      if (page.length < pageSize) break;
      pageFrom += pageSize;
    }
  }

  const mappedUsers = (users ?? []).map((u: any) => ({ user_id: u.id, gamertag: u.gamertag }));
  const myBracket = (bracketLb ?? []).find((r: any) => r.user_id === user!.id);
  const r2HasProps = (roundPropsLbR2 ?? []).length > 0;
  const myPropsR1 = (roundPropsLbR1 ?? []).find((r: any) => r.user_id === user!.id);
  const myPropsR2 = (roundPropsLbR2 ?? []).find((r: any) => r.user_id === user!.id);
  const myProps = r2HasProps ? myPropsR2 : myPropsR1;
  const heroPropsRoundLabel = r2HasProps ? "R2 Props" : "R1 Props";
  const totalPlayers = mappedUsers.length;

  // Enrich props leaderboard with hit rate + yesterday points
  const propsList = (props ?? []) as any[];
  const etDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = etDate(yesterday);
  const pastProps = propsList.filter((p: any) => p.locks_at && etDate(p.locks_at) === yesterdayStr);
  const yesterdayPropIds = new Set(pastProps.map((p: any) => p.id));
  const resolvedPropIds = new Set(propsList.filter((p: any) => p.status === "resolved" || p.status === "locked").map((p: any) => p.id));

  const yesterdayPointsByUser: Record<string, number> = {};
  const hitsByUser: Record<string, number> = {};
  const totalsByUser: Record<string, number> = {};
  for (const pp of propPicks) {
    if (yesterdayPropIds.has(pp.prop_id) && pp.is_correct === true) {
      yesterdayPointsByUser[pp.user_id] = (yesterdayPointsByUser[pp.user_id] ?? 0) + (pp.awarded_points ?? 0);
    }
    if (resolvedPropIds.has(pp.prop_id)) {
      totalsByUser[pp.user_id] = (totalsByUser[pp.user_id] ?? 0) + 1;
      if (pp.is_correct === true) {
        hitsByUser[pp.user_id] = (hitsByUser[pp.user_id] ?? 0) + 1;
      }
    }
  }
  const enrich = (rows: any[] | null) => (rows ?? []).map((row: any) => {
    const total = totalsByUser[row.user_id] ?? 0;
    const hits = hitsByUser[row.user_id] ?? 0;
    return {
      ...row,
      yesterday_points: yesterdayPointsByUser[row.user_id] ?? 0,
      hit_rate: total > 0 ? Math.round((hits / total) * 100) : null,
    };
  });
  const enrichedPropsR1 = enrich(roundPropsLbR1);
  const enrichedPropsR2 = enrich(roundPropsLbR2);

  const r1SeriesAll = ((series ?? []) as any[]).filter((s: any) => s.round === 1);
  const r1Done = r1SeriesAll.length > 0 && r1SeriesAll.every((s: any) => s.winner_id);

  return (
    <main className="mx-auto max-w-md px-4 pt-safe pb-6">
      <header className="flex items-center justify-between pt-4 pb-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">
            Cup Playoffs · Standings
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

      {/* Hero: your position at a glance */}
      <div className="mb-4 overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-brand/15 via-ink-850 to-ink-900 p-4 shadow-tier-3">
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
              {heroPropsRoundLabel}
            </div>
            <div className="text-[10px] text-ink-500">
              {myProps?.points ?? 0} pts
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard — rows tappable to open per-user bracket modal */}
      <div className="mb-5">
        <LeaderboardSwitcher
          bracket={(bracketLb ?? []) as any}
          propsR1={enrichedPropsR1 as any}
          propsR2={r2HasProps ? (enrichedPropsR2 as any) : null}
          r1Done={r1Done}
          currentUserId={user!.id}
          series={(series ?? []) as any}
          allBracketPicks={(allBracketPicks ?? []) as any}
          profiles={mappedUsers}
        />
      </div>

      {/* Activity feed */}
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