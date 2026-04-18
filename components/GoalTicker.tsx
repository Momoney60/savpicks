"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Event = {
  id: string;
  event_type: string;
  payload: any;
  created_at: string;
};

export default function GoalTicker() {
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("goal-ticker")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_events",
          filter: "event_type=eq.goal_scored",
        },
        (payload: any) => {
          setEvent(payload.new as Event);
          window.setTimeout(() => setEvent(null), 5500);
          if (typeof window !== "undefined" && "vibrate" in navigator) {
            try { navigator.vibrate([20, 30, 50]); } catch {}
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ y: -140, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -140, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.7 }}
          className="pointer-events-none fixed inset-x-0 top-safe z-[60] mx-auto max-w-md px-3 pt-3"
        >
          <div className="overflow-hidden rounded-2xl border border-live/30 bg-ink-900/80 p-3.5 shadow-2xl shadow-live/30 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-live/15 ring-1 ring-live/30">
                <span className="text-2xl">🚨</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[15px] font-black tracking-tight text-live">
                    GOAL
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    {event.payload?.team_name ?? "—"}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-200">
                  <span className="font-display font-black tabular-nums">
                    {event.payload?.away_team} {event.payload?.away_score} — {event.payload?.home_score} {event.payload?.home_team}
                  </span>
                  {event.payload?.period && (
                    <>
                      <span className="text-ink-600">·</span>
                      <span className="text-ink-400">
                        {event.payload.period}{event.payload.clock ? ` ${event.payload.clock}` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
