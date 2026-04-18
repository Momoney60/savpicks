import { createClient } from "@/lib/supabase/server";
import BracketView from "@/components/bracket/BracketView";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: series }, { data: myPicks }, { data: teams }] = await Promise.all([
    supabase
      .from("series")
      .select("*, team_a:team_a_id(*), team_b:team_b_id(*), winner:winner_id(*)")
      .order("round")
      .order("bracket_slot"),
    supabase
      .from("bracket_picks")
      .select("*")
      .eq("user_id", user!.id),
    supabase.from("teams").select("*"),
  ]);

  return (
    <main className="mx-auto max-w-md px-4 pt-safe">
      <header className="pt-4 pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand">
          The Bracket
        </p>
        <h1 className="font-display text-2xl font-black tracking-tight">
          Pick winners. Compound streaks.
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Ride a team from Round 1 to the Cup for up to 8× points.
        </p>
      </header>

      <BracketView
        series={series ?? []}
        myPicks={myPicks ?? []}
        teams={teams ?? []}
      />
    </main>
  );
}
