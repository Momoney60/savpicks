import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const t0 = Date.now();
  let body: any = null;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const prop_id = body?.prop_id;
  const selection = body?.selection;

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn(`[picks/prop] event=auth_fail prop=${prop_id ?? "?"} sel=${selection ?? "?"} err=${authError?.message ?? "no_user"}`);
      return NextResponse.json(
        { error: "Not authenticated. Log in again." },
        { status: 401 }
      );
    }

    const ctx = `user=${user.id} prop=${prop_id ?? "?"} sel=${selection ?? "?"}`;
    console.log(`[picks/prop] event=received ${ctx}`);

    if (!prop_id || selection === undefined || selection === null) {
      console.warn(`[picks/prop] event=missing_fields ${ctx}`);
      return NextResponse.json(
        { error: "Missing prop_id or selection" },
        { status: 400 }
      );
    }

    const { data: prop, error: propError } = await supabase
      .from("props")
      .select("id, prop_type, status, locks_at")
      .eq("id", prop_id)
      .single();

    if (propError || !prop) {
      console.warn(`[picks/prop] event=prop_not_found ${ctx} err=${propError?.message}`);
      return NextResponse.json({ error: "Prop not found" }, { status: 404 });
    }

    if (prop.status !== "open") {
      console.warn(`[picks/prop] event=not_open ${ctx} status=${prop.status}`);
      return NextResponse.json({ error: "Prop is not open" }, { status: 403 });
    }

    if (prop.locks_at && new Date(prop.locks_at) <= new Date()) {
      console.warn(`[picks/prop] event=locked ${ctx} lock=${prop.locks_at}`);
      return NextResponse.json({ error: "Prop is locked" }, { status: 403 });
    }

    // NTS picks are COMMIT-ONCE: can't change after first pick
    if (prop.prop_type === "next_team_to_score") {
      const { data: existing } = await supabase
        .from("prop_picks")
        .select("id, selection")
        .eq("prop_id", prop_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        console.warn(`[picks/prop] event=nts_already_committed ${ctx}`);
        return NextResponse.json(
          { error: "Next Goal picks are locked once made — no switching allowed." },
          { status: 403 }
        );
      }

      const { error: insertError } = await supabase
        .from("prop_picks")
        .insert({
          user_id: user.id,
          prop_id,
          selection,
        });

      if (insertError) {
        console.error(`[picks/prop] event=db_error_insert ${ctx} err=${insertError.message}`);
        return NextResponse.json(
          { error: insertError.message ?? "Database error saving pick" },
          { status: 500 }
        );
      }

      console.log(`[picks/prop] event=saved_nts ${ctx} ms=${Date.now() - t0}`);
      return NextResponse.json({ ok: true, locked: true });
    }

    // All other prop types (H2H, PIM): upsert allowed until prop locks
    const { error: upsertError } = await supabase
      .from("prop_picks")
      .upsert(
        { user_id: user.id, prop_id, selection },
        { onConflict: "user_id,prop_id" }
      );

    if (upsertError) {
      console.error(`[picks/prop] event=db_error_upsert ${ctx} err=${upsertError.message}`);
      return NextResponse.json(
        { error: upsertError.message ?? "Database error saving pick" },
        { status: 500 }
      );
    }

    console.log(`[picks/prop] event=saved ${ctx} ms=${Date.now() - t0}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(`[picks/prop] event=fatal prop=${prop_id ?? "?"} sel=${selection ?? "?"} err=${e?.message ?? String(e)}`);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}