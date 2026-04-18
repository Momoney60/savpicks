import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const db = createServiceClient();

  const [
    { count: userCount },
    { count: paidCount },
    { count: seriesCount },
    { count: liveCount },
    { count: pickCount },
    { count: propCount },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("profiles").select("*", { count: "exact", head: true }).eq("is_paid", true),
    db.from("series").select("*", { count: "exact", head: true }),
    db.from("games").select("*", { count: "exact", head: true }).eq("status", "live"),
    db.from("bracket_picks").select("*", { count: "exact", head: true }),
    db.from("prop_picks").select("*", { count: "exact", head: true }),
  ]);

  return (
    <>
      <h2 className="font-display text-2xl font-black mb-6">Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Total users" value={userCount ?? 0} />
        <Stat label="Paid users" value={paidCount ?? 0} accent={paidCount === userCount ? "brand" : "pending"} />
        <Stat label="Series" value={seriesCount ?? 0} />
        <Stat label="Live games" value={liveCount ?? 0} accent={liveCount ? "live" : undefined} />
        <Stat label="Bracket picks" value={pickCount ?? 0} />
        <Stat label="Prop picks" value={propCount ?? 0} />
      </div>

      <div className="mt-10 rounded-2xl border border-ink-700 bg-ink-850 p-6">
        <h3 className="font-display text-lg font-bold">Setup checklist</h3>
        <ul className="mt-4 space-y-2 text-sm text-ink-300">
          <li>✅ Database schema migrated</li>
          <li>✅ 32 NHL teams seeded</li>
          <li>⏳ Invite your pool members (Users tab)</li>
          <li>⏳ Mark paid entries as they come in</li>
          <li>⏳ Create Round 1 series when matchups are official</li>
          <li>⏳ Create nightly pregame props (H2H + PIM O/U)</li>
          <li>⏳ Wire Val Town cron jobs for live scoring</li>
        </ul>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "brand" | "live" | "pending";
}) {
  const accentClass = {
    brand: "text-brand",
    live: "text-live",
    pending: "text-pending",
  }[accent ?? "brand"];
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
      <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{label}</div>
      <div className={`mt-1 font-display text-3xl font-black ${accent ? accentClass : "text-ink-100"}`}>
        {value}
      </div>
    </div>
  );
}
