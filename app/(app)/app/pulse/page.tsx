import { createClient } from "@/lib/supabase/server";
import LeaderboardTable from "@/components/pulse/LeaderboardTable";
import ActivityFeed from "@/components/pulse/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const supabase = createClient();

  const [{ data: leaderboard }, { data: activity }, { data: profile }] = await Promise.all([
    supabase.from("leaderboard").select("*").order("rank").limit(20),
    supabase
      .from("activity_events")
      .select("*, profiles(gamertag, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("profiles")
      .select("gamertag, is_paid")
      .eq("id", (await supabase.auth.getUser()).data.user!.id)
      .single(),
  ]);

  return (
    <main className="mx-auto max-w-md px-4 pt-safe">
      {/* Header */}
      <header className="flex items-center justify-between pt-4 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
            Welcome back
          </p>
          <h1 className="font-display text-2xl font-black tracking-tight">
            {profile?.gamertag ?? "Picker"}
          </h1>
        </div>
        {!profile?.is_paid && (
          <span className="rounded-full border border-pending/30 bg-pending/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-pending">
            Unpaid
          </span>
        )}
      </header>

      {/* Section: Leaderboard */}
      <section className="mb-6">
        <SectionHeader title="Leaderboard" subtitle="Total points, all sources" />
        <LeaderboardTable rows={leaderboard ?? []} />
      </section>

      {/* Section: Activity */}
      <section>
        <SectionHeader title="Feed" subtitle="Picks, goals, streaks" />
        <ActivityFeed events={activity ?? []} />
      </section>
    </main>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-xl font-black tracking-tight">{title}</h2>
      <span className="text-[11px] text-ink-400">{subtitle}</span>
    </div>
  );
}
