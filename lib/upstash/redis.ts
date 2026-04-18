import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Redis channel naming conventions.
 * Keep these centralized so publishers and subscribers stay in sync.
 */
export const channels = {
  // Floating emote reactions during a live game
  reactions: (gameId: string) => `reactions:game:${gameId}`,

  // Next-Team-To-Score prop updates (new NTS opened, resolved, etc.)
  liveProps: (gameId: string) => `liveprops:game:${gameId}`,

  // Global activity feed (picks placed, goals, milestones)
  activity: () => `activity:global`,

  // Chat (fallback — primary transport is Supabase Realtime)
  chat: (room: string) => `chat:${room}`,
} as const;

/**
 * Reaction emoji whitelist. Keep in sync with the UI reaction picker.
 * Free-form emojis are rejected server-side.
 */
export const REACTION_EMOJIS = ["🔥", "⚡️", "💀", "😤", "🎯", "👑", "🥶", "🚨"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
