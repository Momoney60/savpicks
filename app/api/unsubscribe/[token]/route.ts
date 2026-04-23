import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("user_preferences")
    .update({ email_reminders: false, updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select()
    .maybeSingle();

  const success = !!data;

  const html = success
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px;">
  <div style="text-align:center;max-width:400px;">
    <div style="font-size:56px;">🤖</div>
    <h1 style="color:#7DD3FC;margin:20px 0 10px;font-size:26px;font-weight:900;">You're out.</h1>
    <p style="color:#9ca3af;margin:0 0 28px;font-size:15px;line-height:1.5;">SavBot 2.0 won't email you reminders anymore. Peace ✌️</p>
    <a href="https://savpicks.com/app/live" style="color:#7DD3FC;text-decoration:none;font-size:14px;">← Back to SavPicks</a>
  </div>
</body></html>`
    : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid link</title></head>
<body style="background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px;">
  <div style="text-align:center;max-width:400px;">
    <h1 style="color:#ef4444;font-size:22px;">Invalid unsubscribe link</h1>
    <p style="color:#9ca3af;font-size:14px;">This link is invalid or has been used already. If you want to re-enable reminders, sign in to SavPicks.</p>
  </div>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" }, status: success ? 200 : 404 });
}
