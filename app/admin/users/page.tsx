import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function togglePaid(formData: FormData) {
  "use server";
  const userId = formData.get("user_id") as string;
  const current = formData.get("current") === "true";
  const db = createServiceClient();
  await db.from("profiles").update({ is_paid: !current }).eq("id", userId);
  revalidatePath("/admin/users");
}

async function toggleAdmin(formData: FormData) {
  "use server";
  const userId = formData.get("user_id") as string;
  const current = formData.get("current") === "true";
  const db = createServiceClient();
  await db.from("profiles").update({ is_admin: !current }).eq("id", userId);
  revalidatePath("/admin/users");
}

async function updateGamertag(formData: FormData) {
  "use server";
  const userId = formData.get("user_id") as string;
  const gamertag = (formData.get("gamertag") as string).trim();
  if (!gamertag || gamertag.length < 2 || gamertag.length > 24) return;
  const db = createServiceClient();
  await db.from("profiles").update({ gamertag }).eq("id", userId);
  revalidatePath("/admin/users");
}

export default async function UsersPage() {
  const db = createServiceClient();
  const { data: profiles } = await db
    .from("profiles")
    .select("id, gamertag, is_paid, is_admin, created_at")
    .order("created_at", { ascending: true });

  return (
    <>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-black">Users</h2>
        <span className="text-sm text-ink-400">{profiles?.length ?? 0} total</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
        <table className="w-full">
          <thead className="border-b border-ink-700 bg-ink-800 text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="px-4 py-3 text-left">Gamertag</th>
              <th className="px-4 py-3 text-center">Paid</th>
              <th className="px-4 py-3 text-center">Admin</th>
              <th className="px-4 py-3 text-right">Joined</th>
            </tr>
          </thead>
          <tbody>
            {profiles?.map((p: any) => (
              <tr key={p.id} className="border-b border-ink-700/50 last:border-b-0">
                <td className="px-4 py-3">
                  <form action={updateGamertag} className="flex gap-2">
                    <input type="hidden" name="user_id" value={p.id} />
                    <input
                      type="text"
                      name="gamertag"
                      defaultValue={p.gamertag}
                      minLength={2}
                      maxLength={24}
                      className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-sm text-ink-100 focus:border-brand focus:outline-none"
                    />
                    <button type="submit" className="rounded-md bg-ink-700 px-2 py-1 text-xs font-semibold text-ink-100 hover:bg-ink-600">
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-center">
                  <form action={togglePaid}>
                    <input type="hidden" name="user_id" value={p.id} />
                    <input type="hidden" name="current" value={String(p.is_paid)} />
                    <button type="submit" className={p.is_paid ? "rounded-md bg-brand/20 px-3 py-1 text-xs font-bold text-brand" : "rounded-md bg-ink-700 px-3 py-1 text-xs font-semibold text-ink-300 hover:bg-ink-600"}>
                      {p.is_paid ? "✓ Paid" : "Mark Paid"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-center">
                  <form action={toggleAdmin}>
                    <input type="hidden" name="user_id" value={p.id} />
                    <input type="hidden" name="current" value={String(p.is_admin)} />
                    <button type="submit" className={p.is_admin ? "rounded-md bg-loss/20 px-3 py-1 text-xs font-bold text-loss" : "rounded-md bg-ink-700 px-3 py-1 text-xs font-semibold text-ink-300 hover:bg-ink-600"}>
                      {p.is_admin ? "★ Admin" : "Make Admin"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-right text-xs text-ink-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(!profiles || profiles.length === 0) && (
        <p className="mt-8 text-center text-sm text-ink-400">
          No users yet. Share your site URL — sign-ups will appear here.
        </p>
      )}
    </>
  );
}
