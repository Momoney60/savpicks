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

  if (user) redirect("/app/live");

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-ink-900 pt-safe">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(700px circle at 50% 20%, rgba(125, 211, 252, 0.18), transparent 60%), radial-gradient(900px circle at 50% 100%, rgba(255, 45, 85, 0.10), transparent 70%)",
        }}
      />

      {/* Floating puck — subtle animation */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 select-none text-[120px] opacity-[0.06] blur-[1px]"
      >
        🏒
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 pb-12 pt-20">
        {/* Top */}
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-brand">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            Playoffs 2026
          </div>

          <h1 className="mt-8 font-display text-[68px] font-black leading-[0.95] tracking-tighter text-ink-100">
            Sav
            <span className="bg-gradient-to-br from-brand via-brand to-sky-400 bg-clip-text text-transparent">
              Picks
            </span>
          </h1>

          <p className="mt-5 text-[17px] leading-snug text-ink-300">
            Pick. <span className="text-brand">Ride.</span> Win.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12">
          <AuthSheet defaultOpen={searchParams.auth === "required"} />
          <p className="mt-4 text-center text-[11px] uppercase tracking-widest text-ink-500">
            Private pool · invite only
          </p>
        </div>
      </div>
    </main>
  );
}