import { createClient } from "@/lib/supabase/server";
import LiveView from "@/components/live/LiveView";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: games }, { data: openProps }, { data: myPicks }] = await Promise.all([
    supabase
      .from("games")
      .select("*, home_team:home_team_id(*), away_team:away_team_id(*)")
      .in("status", ["live", "scheduled"])
      .order("scheduled_at"),
    supabase
      .from("props")
      .select("*")
      .in("status", ["open", "locked"])
      .order("locks_at"),
    supabase
      .from("prop_picks")
      .select("*")
      .eq("user_id", user!.id),
  ]);

  return (
    <main className="mx-auto max-w-md px-4 pt-safe">
      <header className="pt-4 pb-5">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-live">
          <span className="h-1.5 w-1.5 rounded-full bg-live live-dot" />
          Live
        </p>
        <h1 className="font-display text-2xl font-black tracking-tight">
          Tonight&apos;s Action
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Pregame grudge matches · Live next-goal markets
        </p>
      </header>

      <LiveView
        games={games ?? []}
        props={openProps ?? []}
        myPicks={myPicks ?? []}
      />
    </main>
  );
}
