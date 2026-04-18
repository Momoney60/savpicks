"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import type { ActivityEvent } from "@/lib/types/database";

type FeedEvent = ActivityEvent & {
  profiles?: { gamertag: string | null; avatar_url: string | null } | null;
};

const eventMeta: Record<
  ActivityEvent["event_type"],
  { icon: string; color: string; label: (p: any, actor?: string) => string }
> = {
  pick_placed: {
    icon: "🎯",
    color: "text-ink-300",
    label: (p, actor) =>
      p.pick_kind === "bracket"
        ? `${actor ?? "Someone"} placed a bracket pick`
        : `${actor ?? "Someone"} placed a prop pick`,
  },
  pick_hit: {
    icon: "✅",
    color: "text-brand",
    label: (p, actor) => `${actor ?? "Someone"} hit for ${p.points ?? "?"} pts`,
  },
  pick_miss: {
    icon: "❌",
    color: "text-ink-400",
    label: (_p, actor) => `${actor ?? "Someone"} missed a pick`,
  },
  streak_milestone: {
    icon: "🔥",
    color: "text-brand",
    label: (p, actor) =>
      `${actor ?? "Someone"} hit a ${p.streak ?? "?"}× streak (${p.points ?? "?"} pts!)`,
  },
  goal_scored: {
    icon: "🚨",
    color: "text-live",
    label: (p) => `GOAL — ${p.team_id ?? "???"}`,
  },
  series_clinched: {
    icon: "🏆",
    color: "text-pending",
    label: (p) => `Series clinched — ${p.winner_id ?? "???"} advance`,
  },
  new_leader: {
    icon: "👑",
    color: "text-brand",
    label: (_p, actor) => `${actor ?? "Someone"} took over #1`,
  },
  admin_announcement: {
    icon: "📣",
    color: "text-ink-100",
    label: (p) => p.message ?? "Announcement",
  },
};

export default function ActivityFeed({ events: initial }: { events: FeedEvent[] }) {
  const [events, setEvents] = useState<FeedEvent[]>(initial);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        async (payload) => {
          const evt = payload.new as ActivityEvent;
          let gamertag: string | null = null;
          if (evt.actor_id) {
            const { data } = await supabase
              .from("profiles")
              .select("gamertag, avatar_url")
              .eq("id", evt.actor_id)
              .single();
            gamertag = data?.gamertag ?? null;
          }
          setEvents((prev) => [
            { ...evt, profiles: { gamertag, avatar_url: null } } as FeedEvent,
            ...prev,
          ].slice(0, 30));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-850 p-6 text-center">
        <div className="text-4xl">💤</div>
        <p className="mt-3 text-sm text-ink-400">Nothing&apos;s happened yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {events.map((evt) => {
          const meta = eventMeta[evt.event_type];
          const actor = evt.profiles?.gamertag ?? undefined;
          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3"
            >
              <div className="text-xl">{meta.icon}</div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${meta.color}`}>
                  {meta.label(evt.payload as any, actor)}
                </div>
                <div className="text-[11px] text-ink-500">
                  {formatRelativeTime(evt.created_at)} ago
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
