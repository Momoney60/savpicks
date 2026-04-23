import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const maxDuration = 60;

const INGEST_SECRET = process.env.INGEST_SHARED_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(request: Request) {
  const secret = request.headers.get("x-ingest-secret");
  if (!INGEST_SECRET || secret !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "true";
  const force = url.searchParams.get("force") === "true";
  const forceDate = url.searchParams.get("date");

  const supabase = createServiceClient();

  const { data: games } = await supabase
    .from("games")
    .select("id, scheduled_at, home_team_id, away_team_id, status")
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(1);

  if (!games || games.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no scheduled games" });
  }

  const firstGame = games[0];
  const puckDropMs = new Date(firstGame.scheduled_at).getTime();
  const nowMs = Date.now();
  const minutesUntilPuckDrop = Math.round((puckDropMs - nowMs) / 60000);

  const inWindow = minutesUntilPuckDrop >= 55 && minutesUntilPuckDrop <= 75;

  if (!inWindow && !dryRun && !force) {
    return NextResponse.json({ ok: true, skipped: "not in window", minutesUntilPuckDrop });
  }

  const etDate = forceDate ?? new Date(puckDropMs).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  if (!dryRun && !force) {
    const { data: existing } = await supabase
      .from("reminder_sends")
      .select("id")
      .eq("date", etDate)
      .eq("kind", "pregame_1h")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, skipped: "already sent today" });
    }
  }

  const todayStart = new Date(etDate + "T00:00:00-05:00").toISOString();
  const todayEnd = new Date(etDate + "T23:59:59-04:00").toISOString();

  const { data: todayProps } = await supabase
    .from("props")
    .select("id")
    .eq("status", "open")
    .gte("locks_at", todayStart)
    .lte("locks_at", todayEnd);

  if (!todayProps || todayProps.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no open props today" });
  }

  const propIds = todayProps.map((p) => p.id);

  const [authResult, picksResult, prefsResult, publicUsersResult] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from("prop_picks").select("user_id, prop_id").in("prop_id", propIds),
    supabase.from("user_preferences").select("user_id, email_reminders, unsubscribe_token"),
    supabase.from("users").select("user_id, gamertag"),
  ]);

  const authUsers = authResult.data?.users ?? [];
  const gamertagMap = new Map((publicUsersResult.data ?? []).map((u: any) => [u.user_id, u.gamertag]));

  const picksByUser = new Map<string, Set<string>>();
  (picksResult.data ?? []).forEach((p: any) => {
    if (!p.user_id) return;
    if (!picksByUser.has(p.user_id)) picksByUser.set(p.user_id, new Set());
    picksByUser.get(p.user_id)!.add(p.prop_id);
  });

  const prefsMap = new Map((prefsResult.data ?? []).map((p: any) => [p.user_id, p]));

  const recipients: { email: string; gamertag: string; unsubscribe_token: string; missing_count: number }[] = [];
  for (const user of authUsers) {
    if (!user.email) continue;
    if (!user.email_confirmed_at) continue;
    const prefs = prefsMap.get(user.id);
    if (prefs && (prefs as any).email_reminders === false) continue;
    const userPicks = picksByUser.get(user.id) ?? new Set();
    const missing = propIds.filter((pid) => !userPicks.has(pid));
    if (missing.length === 0) continue;
    recipients.push({
      email: user.email,
      gamertag: gamertagMap.get(user.id) ?? user.email.split("@")[0],
      unsubscribe_token: (prefs as any)?.unsubscribe_token ?? "",
      missing_count: missing.length,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      date: etDate,
      first_game: firstGame.away_team_id + " @ " + firstGame.home_team_id,
      puck_drop: firstGame.scheduled_at,
      minutes_until_puck_drop: minutesUntilPuckDrop,
      in_window: inWindow,
      total_open_props_today: todayProps.length,
      recipients_count: recipients.length,
      recipients: recipients.map((r) => ({ gamertag: r.gamertag, email: r.email.replace(/(.{2}).*(@.*)/, "$1***$2"), missing: r.missing_count })),
    });
  }

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }
  const resend = new Resend(RESEND_API_KEY);

  const results: any[] = [];
  for (const r of recipients) {
    try {
      const res = await resend.emails.send({
        from: "SavBot <savbot@savpicks.com>",
        to: r.email,
        subject: "🏒 SavBot 2.0 here — puck drops in 1 hour",
        html: buildEmailHtml(r),
      });
      results.push({ email: r.email, status: "sent", id: res.data?.id, error: res.error?.message });
    } catch (e: any) {
      results.push({ email: r.email, status: "error", error: e.message });
    }
  }

  await supabase.from("reminder_sends").insert({
    date: etDate,
    kind: "pregame_1h",
    recipient_count: recipients.length,
    metadata: { results, first_game: firstGame.away_team_id + " @ " + firstGame.home_team_id },
  });

  return NextResponse.json({
    ok: true,
    date: etDate,
    sent: results.filter((r) => r.status === "sent").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  });
}

function buildEmailHtml(r: { gamertag: string; unsubscribe_token: string; missing_count: number }): string {
  const ubUrl = "https://savpicks.com/api/unsubscribe/" + r.unsubscribe_token;
  const ctaUrl = "https://savpicks.com/app/live";
  const missingText = r.missing_count === 1 ? "1 pick still unmade" : r.missing_count + " picks still unmade";
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:40px 24px;"><div style="text-align:center;margin-bottom:32px;"><div style="font-size:42px;line-height:1;">🏒</div><h1 style="font-size:24px;font-weight:900;letter-spacing:-0.5px;margin:18px 0 6px;color:#7DD3FC;">SavBot 2.0</h1><div style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;color:#6b7280;letter-spacing:0.25em;">BEEP BOOP BAAP</div></div><div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;padding:32px 28px;"><p style="font-size:17px;line-height:1.5;margin:0 0 18px;color:#fff;"><strong style="color:#7DD3FC;">' + r.gamertag + '</strong>, this is SavBot 2.0 🤖</p><p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#d4d4d4;">First puck drop is in 1 hour. Reminder to make your picks — you have <strong style="color:#fff;">' + missingText + '</strong>.</p><div style="text-align:center;margin:32px 0 8px;"><a href="' + ctaUrl + '" style="display:inline-block;background:#7DD3FC;color:#0a0a0a;text-decoration:none;padding:14px 34px;border-radius:999px;font-weight:900;font-size:15px;letter-spacing:0.02em;">Lock in your picks →</a></div></div><div style="text-align:center;margin-top:28px;font-size:11px;color:#6b7280;"><a href="' + ubUrl + '" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a></div></div></body></html>';
}
