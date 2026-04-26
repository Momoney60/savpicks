import { createClient } from "@/lib/supabase/server";
import BracketView from "@/components/bracket/BracketView";
import MiniBracket from "@/components/bracket/MiniBracket";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: series }, { data: myPicks }, { data: teams }, { data: allBracketPicks }, { data: profiles }] = await Promise.all([
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
    supabase.from("bracket_picks").select("user_id, series_id, picked_team_id"),
    supabase.from("profiles").select("id, gamertag"),
  ]);

  const mappedProfiles = (profiles ?? []).map((p: any) => ({ user_id: p.id, gamertag: p.gamertag }));

  return (
    <main className="mx-auto max-w-md px-4 pt-safe">
      <div className="mb-4 pt-4">
        <MiniBracket
          series={(series ?? []) as any}
          myPicks={(myPicks ?? []) as any}
          allBracketPicks={(allBracketPicks ?? []) as any}
          profiles={mappedProfiles}
          currentUserId={user!.id}
        />
      </div>

      <BracketView
        series={series ?? []}
        myPicks={myPicks ?? []}
        teams={teams ?? []}
        currentUserId={user!.id}
      />
    </main>
  );
}