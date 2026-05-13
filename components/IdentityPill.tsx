// Subtle "you" identity strip — pinned top-right across all in-app pages.
// Server component: looks up user's gamertag + bracket rank + points.
import { createClient } from "@/lib/supabase/server";

export default async function IdentityPill() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: lb }] = await Promise.all([
    supabase.from("profiles").select("gamertag").eq("id", user.id).single(),
    supabase.from("bracket_leaderboard").select("rank, points").eq("user_id", user.id).maybeSingle(),
  ]);

  const gamertag = profile?.gamertag ?? "Picker";
  const rank = lb?.rank;
  const points = lb?.points ?? 0;

  return (
    <div className="pointer-events-none fixed right-3 top-safe z-20 pt-2">
      <div className="rounded-full border border-ink-700/60 bg-ink-900/80 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-300 shadow-sm backdrop-blur-md">
        <span className="text-ink-200">{gamertag}</span>
        {rank != null && (
          <>
            <span className="mx-1 text-ink-600">·</span>
            <span className="text-brand">#{rank}</span>
            <span className="mx-1 text-ink-600">·</span>
            <span className="text-ink-300 tabular-nums">{points}</span>
            <span className="ml-0.5 text-ink-500">pts</span>
          </>
        )}
      </div>
    </div>
  );
}