import { createClient } from "@/lib/supabase/server";
import { redis, channels, REACTION_EMOJIS } from "@/lib/upstash/redis";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { game_id, emoji, persist = false, target_type, target_id } = body;

  if (!emoji || !REACTION_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "invalid emoji" }, { status: 400 });
  }

  if (game_id) {
    // Floating reaction — publish for ~3 second TTL fanout
    await redis.publish(
      channels.reactions(game_id),
      JSON.stringify({ emoji, user_id: user.id, ts: Date.now() })
    );
  }

  if (persist && target_type && target_id) {
    await supabase.from("reactions").upsert(
      { user_id: user.id, target_type, target_id, emoji },
      { onConflict: "user_id,target_type,target_id,emoji" }
    );
  }

  return NextResponse.json({ ok: true });
}
