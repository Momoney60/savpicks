import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AuthSheet from "@/components/AuthSheet";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: { auth?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already logged in → send to app
  if (user) redirect("/app/pulse");

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900 pt-safe">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, rgba(0, 229, 168, 0.15), transparent 60%), radial-gradient(800px circle at 50% 100%, rgba(255, 45, 85, 0.08), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-md px-6 pt-16 pb-24">
        {/* Wordmark */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-live live-dot" />
          Private Pool · Playoffs 2026
        </div>

        {/* Hero */}
        <h1 className="mt-6 font-display text-[44px] leading-[1.05] font-black tracking-tight text-ink-100">
          Your bracket.
          <br />
          <span className="text-brand">Your streak.</span>
          <br />
          Your money.
        </h1>

        <p className="mt-5 text-[17px] leading-relaxed text-ink-300">
          A private playoff pool for people who actually watch the games. Pick
          series winners, compound your streak for up to <span className="text-brand font-semibold">8× payouts</span>, and battle your friends on live props all postseason.
        </p>

        {/* Feature cards */}
        <div className="mt-10 space-y-3">
          <FeatureCard
            title="Streak Multipliers"
            body="Ride a team from Round 1 to the Cup? That final pick is worth 8×. Hedge and collect 1×. Game theory, not guesswork."
            accent="text-brand"
            chip="1× → 8×"
          />
          <FeatureCard
            title="Live Micro-Markets"
            body="Next team to score. Every goal, instantly. A 6–5 game gives you 11 chances to steal a point."
            accent="text-live"
            chip="1 pt / hit"
          />
          <FeatureCard
            title="Pregame Grudge Matches"
            body="MacKinnon or McDavid? Over or under on PIMs? Lock your side before puck drop. 5 points on the line."
            accent="text-pending"
            chip="5 pts"
          />
        </div>

        {/* Stakes block */}
        <div className="mt-10 rounded-2xl border border-ink-700 bg-ink-850 p-5">
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">
            The Stakes
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-4xl font-black text-ink-100">$100</span>
            <span className="text-sm text-ink-400">entry · winner takes pot</span>
          </div>
          <div className="mt-3 text-sm text-ink-300">
            Invite-only. You know who you are. Pay the commish before Round 1
            puck drop or your picks don&apos;t count.
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10">
          <AuthSheet defaultOpen={searchParams.auth === "required"} />
        </div>

        {/* Footer */}
        <div className="mt-16 flex items-center justify-between text-[11px] text-ink-500">
          <span>© 2026 SavPicks</span>
          <Link href="/app/rules" className="hover:text-ink-300">
            Scoring & Rules
          </Link>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  body,
  accent,
  chip,
}: {
  title: string;
  body: string;
  accent: string;
  chip: string;
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[17px] font-bold text-ink-100">{title}</h3>
        <span className={`text-[11px] font-black uppercase tracking-wider ${accent}`}>
          {chip}
        </span>
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-300">{body}</p>
    </div>
  );
}
