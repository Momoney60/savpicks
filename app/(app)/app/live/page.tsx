import { createClient } from "@/lib/supabase/server";
import LiveView from "@/components/live/LiveView";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const next36h = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();

  const [
    { data: games },
    { data: upcomingSeries },
    { data: allSeries },
    { data: openProps },
    { data: allProps },
    { data: myPicks },
    { data: allPropPicks },
    { data: users },
    { data: allBracketPicks },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("*, home_team:home_team_id(*), away_team:away_team_id(*)")
      .in("status", ["live", "final", "scheduled"])
      .gte("scheduled_at", last24h)
        .lte("scheduled_at", next36h)
        .order("scheduled_at", { ascending: true })
      .limit(20),
    supabase
      .from("series")
      .select("id, team_a_id, team_b_id, picks_lock_at, team_a:team_a_id(*), team_b:team_b_id(*), bracket_slot, conference, round")
      .in("status", ["upcoming", "live"])
      .lte("picks_lock_at", in48h)
      .gte("picks_lock_at", now.toISOString())
      .order("picks_lock_at"),
    supabase
      .from("series")
      .select("id, team_a_id, team_b_id, wins_a, wins_b, winner_id, status, round"),
    supabase.from("props").select("*").in("status", ["open", "locked"]).order("locks_at"),
    supabase.from("props").select("*"),
    supabase.from("prop_picks").select("*").eq("user_id", user!.id),
    supabase.from("prop_picks").select("user_id, prop_id, selection"),
    supabase.from("profiles").select("id, gamertag"),
    supabase.from("bracket_picks").select("user_id, series_id, picked_team_id"),
  ]);

  const syntheticGames = (upcomingSeries ?? []).map((s: any) => ({
    id: `pending-${s.id}`,
    status: "scheduled" as const,
    home_team_id: s.team_a_id,
    away_team_id: s.team_b_id,
    home_score: 0,
    away_score: 0,
    period: null,
    clock: null,
    scheduled_at: s.picks_lock_at,
    home_team: s.team_a,
    away_team: s.team_b,
    player_stats: [],
    total_pim: 0,
  }));

  const realGameSeries = new Set((games ?? []).map((g: any) => `${g.home_team_id}-${g.away_team_id}`));
  const filteredSynthetic = syntheticGames.filter((g) => !realGameSeries.has(`${g.home_team_id}-${g.away_team_id}`));
  const combined = [...(games ?? []), ...filteredSynthetic];

  const mappedUsers = (users ?? []).map((u: any) => ({ user_id: u.id, gamertag: u.gamertag }));

  return (
    <main className="mx-auto max-w-md px-4 pt-safe pb-6">
      <header className="pt-4 pb-5">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-live">
          <span className="h-1.5 w-1.5 rounded-full bg-live live-dot" />
          Live
        </p>
        <h1 className="font-display text-2xl font-black tracking-tight">Tonight&apos;s Action</h1>
        <p className="mt-1 text-sm text-ink-400">Live scores · Pregame markets · Resolved games</p>
      </header>

      <LiveView
        games={combined as any}
        props={(allProps ?? []) as any}
        myPicks={myPicks ?? []}
        allPropPicks={allPropPicks ?? []}
        users={mappedUsers}
        currentUserId={user!.id}
        seriesRecords={(allSeries ?? []) as any}
        allBracketPicks={(allBracketPicks ?? []) as any}
      />
    </main>
  );
}