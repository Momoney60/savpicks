import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function saveGamertag(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const raw = (formData.get("gamertag") as string) ?? "";
  const gamertag = raw.trim();

  if (gamertag.length < 2 || gamertag.length > 24) {
    return;
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("gamertag", gamertag)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) {
    return;
  }

  await service
    .from("profiles")
    .update({ gamertag, has_set_gamertag: true })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/app/pulse");
}

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("gamertag, has_set_gamertag")
    .eq("id", user.id)
    .single();

  if (profile?.has_set_gamertag) redirect("/app/pulse");

  return (
    <main className="mx-auto max-w-md px-6 pt-safe">
      <div className="pt-16 pb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
          One more thing
        </p>
        <h1 className="mt-4 font-display text-3xl font-black tracking-tight">
          Claim your gamertag.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-300">
          This is how everyone sees you on the leaderboard, in chat, on activity
          feeds. Pick something your pool knows you by.
        </p>
      </div>

      <form action={saveGamertag} className="space-y-4">
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-ink-400">
            Your gamertag
          </label>
          <input
            type="text"
            name="gamertag"
            required
            minLength={2}
            maxLength={24}
            defaultValue={profile?.gamertag ?? ""}
            autoFocus
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-4 font-display text-[20px] font-bold text-ink-100 placeholder:text-ink-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="mt-2 text-[11px] text-ink-500">
            2–24 characters. Spaces, emojis, whatever you want. Must be unique in the pool.
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-brand py-4 font-display text-[17px] font-bold text-ink-900 shadow-glow transition active:scale-[0.98]"
        >
          Enter the Pool →
        </button>
      </form>
    </main>
  );
}
