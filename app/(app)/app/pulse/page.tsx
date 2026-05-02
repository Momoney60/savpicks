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
    { data: roundPropsLbR1 },
    { data: roundPropsLbR2 },
    { data: activity },
    { data: profile },
    { data: series },
    { data: picks },
    { data: users },
    { data: props },
    { data: propPicks },
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
      .select("id, round, bracket_slot, picks_lock_at, winner_id, team_a:team_a_id(id, short_name, logo_url, primary_color), team_b:team_b_id(id, short_name, logo_url, primary_color)")
      .order("bracket_slot"),
    supabase.from("bracket_picks").select("user_id, series_id, picked_team_id, is_correct, locked_at"),
    supabase.from("profiles").select("id, gamertag").order("gamertag"),
    supabase.from("props").select("*").order("locks_at"),
    supabase.from("prop_picks").select("user_id, prop_id, selection, is_correct, awarded_points"),
  ]);

  const mappedUsers = (users ?? []).map((u: any) => ({ user_id: u.id, gamertag: u.gamertag }));
  const myBracket = (bracketLb ?? []).find((r: any) => r.user_id === user!.id);
  const r1HasProps = (roundPropsLbR1 ?? []).length > 0;
  const r2HasProps = (roundPropsLbR2 ?? []).length > 0;
  const myPropsR1 = (roundPropsLbR1 ?? []).find((r: any) => r.user_id === user!.id);
  const myPropsR2 = (roundPropsLbR2 ?? []).find((r: any) => r.user_id === user!.id);
  // Show whichever round is more "current": R2 if it has data, else R1
  const myProps = r2HasProps ? myPropsR2 : myPropsR1;
  const heroPropsRoundLabel = r2HasProps ? "R2 Props" : "R1 Props";
  const totalPlayers = mappedUsers.length;

  const seriesList = (series ?? []) as any[];
  const r1SeriesIds = new Set(seriesList.filter((s: any) => s.round === 1 && s.team_a && s.team_b).map((s: any) => s.id));
  const r2Open = seriesList.filter((s: any) => s.round === 2 && s.team_a && s.team_b);
  const r2SeriesIds = new Set(r2Open.map((s: any) => s.id));
  const myPicks = (picks ?? []).filter((p: any) => p.user_id === user!.id);
  const r1PicksCount = myPicks.filter((p: any) => r1SeriesIds.has(p.series_id)).length;
  const r2PicksCount = myPicks.filter((p: any) => r2SeriesIds.has(p.series_id)).length;
  const r1Total = r1SeriesIds.size;
  const r2Total = r2Open.length;
  const myPropCount = (propPicks ?? []).filter((p: any) => p.user_id === user!.id).length;
  const etDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const todayStr = etDate(new Date());
  const propsList = (props ?? []) as any[];
  const todayProps = propsList.filter((p: any) => p.locks_at && etDate(p.locks_at) === todayStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = etDate(yesterday);
  const pastProps = propsList.filter((p: any) => p.locks_at && etDate(p.locks_at) === yesterdayStr);

  // Per-user enrichment for the props leaderboard
  const allPropPicks = (propPicks ?? []) as any[];
  const yesterdayPropIds = new Set(pastProps.map((p: any) => p.id));
  const resolvedPropIds = new Set(propsList.filter((p: any) => p.status === "resolved" || p.status === "locked").map((p: any) => p.id));
  const yesterdayPointsByUser: Record<string, number> = {};
  const hitsByUser: Record<string, number> = {};
  const totalsByUser: Record<string, number> = {};
  for (const pp of allPropPicks) {
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

  // R1 is "done" when every R1 series has a winner_id
  const r1SeriesAll = seriesList.filter((s: any) => s.round === 1);
  const r1Done = r1SeriesAll.length > 0 && r1SeriesAll.every((s: any) => s.winner_id);


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
      <div className="mb-5 overflow-hidden rounded-3xl border border-brand/15 bg-gradient-to-br from-brand/15 via-ink-850 to-ink-900 p-4 shadow-tier-3">
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

      {/* Unified leaderboard */}
      <div className="mb-3">
        <LeaderboardSwitcher
          bracket={(bracketLb ?? []) as any}
          propsR1={enrichedPropsR1 as any}
          propsR2={r2HasProps ? (enrichedPropsR2 as any) : null}
          r1Done={r1Done}
          currentUserId={user!.id}
        />
      </div>

      {/* Collapsibles */}
      <div className="mb-3 space-y-3">
        <CollapsibleSection
          title="Round 1 Picks"
          subtitle={`Reveals at lock · ${r1Total} ${r1Total === 1 ? "series" : "series"}`}
          count={`${r1PicksCount}/${r1Total}`}
        >
          <PicksVertical
            series={(series ?? []) as any}
            picks={(picks ?? []) as any}
            users={mappedUsers}
            currentUserId={user!.id}
            round={1}
          />
        </CollapsibleSection>

        {r2Total > 0 && (
          <CollapsibleSection
            title="Round 2 Picks"
            subtitle={`Reveals at lock · ${r2Total} ${r2Total === 1 ? "series" : "series"}`}
            count={`${r2PicksCount}/${r2Total}`}
            defaultOpen={true}
          >
            <PicksVertical
              series={(series ?? []) as any}
              picks={(picks ?? []) as any}
              users={mappedUsers}
              currentUserId={user!.id}
              round={2}
            />
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title="Today's Props"
          subtitle="Live and upcoming markets"
          count={`${todayProps.length} markets`}
          defaultOpen={true}
        >
          <PropsLog
            props={todayProps}
            picks={(propPicks ?? []) as any}
            users={mappedUsers}
            currentUserId={user!.id}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Last Night's Props"
          subtitle="Resolved · winners + losers"
          count={`${pastProps.length} games`}
        >
          <PropsLog
            props={pastProps}
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