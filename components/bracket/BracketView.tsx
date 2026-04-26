"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { currentPickRound, type StreakPick, type StreakSeries } from "@/lib/bracketStreaks";
import YourPositionCard from "./YourPositionCard";
import ThisRoundDecision from "./ThisRoundDecision";
import YourJourneyCard from "./YourJourneyCard";
import LeaguePulseCard from "./LeaguePulseCard";

type Team = { id: string; short_name: string; full_name?: string; logo_url: string | null; primary_color: string | null; is_eliminated?: boolean };

type Series = StreakSeries & {
  conference?: string | null;
  bracket_slot?: string;
  picks_lock_at?: string | null;
  team_a?: Team | null;
  team_b?: Team | null;
};

type MyPick = {
  id?: string;
  series_id: string;
  picked_team_id: string;
  awarded_points?: number | null;
  is_correct?: boolean | null;
};

export default function BracketView({
  series,
  myPicks,
  teams,
  allBracketPicks,
  currentUserId,
}: {
  series: Series[];
  myPicks: MyPick[];
  teams: Team[];
  allBracketPicks: StreakPick[];
  currentUserId: string;
}) {
  const myStreakPicks: StreakPick[] = useMemo(
    () => myPicks.map((p) => ({ user_id: currentUserId, series_id: p.series_id, picked_team_id: p.picked_team_id })),
    [myPicks, currentUserId],
  );

  const bankedPoints = useMemo(
    () => myPicks.reduce((sum, p) => sum + (p.awarded_points ?? 0), 0),
    [myPicks],
  );

  const awardedRows = useMemo(
    () => myPicks.map((p) => ({ series_id: p.series_id, awarded_points: p.awarded_points ?? 0 })),
    [myPicks],
  );

  const pickRound = useMemo(() => currentPickRound(series), [series]);

  return (
    <div className="space-y-3 pb-6">
      <FlameLegend />

      <YourPositionCard
        currentUserId={currentUserId}
        myPicks={myStreakPicks}
        series={series}
        teams={teams}
        bankedPoints={bankedPoints}
      />

      <ThisRoundDecision
        currentUserId={currentUserId}
        pickRound={pickRound}
        series={series}
        myPicks={myStreakPicks}
        allBracketPicks={allBracketPicks}
      />

      <YourJourneyCard
        currentUserId={currentUserId}
        myPicks={myStreakPicks}
        series={series}
        teams={teams}
        awarded={awardedRows}
      />

      <LeaguePulseCard
        series={series}
        allBracketPicks={allBracketPicks}
        teams={teams}
      />
    </div>
  );
}

function FlameLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border px-3.5 py-2 text-left transition",
          open ? "border-amber-400/40 bg-amber-400/5" : "border-ink-700 bg-ink-900/40",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-[14px] leading-none">🔥</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-300">What does the flame mean?</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{open ? "Hide" : "Show"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3.5 py-3 text-[12px] leading-snug text-ink-300">
              <p>
                <span className="text-amber-400">🔥</span> = a <strong>ride streak</strong>. Each round you correctly pick the same team again, your points double.
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-500">
                1🔥 +5 · 2🔥 +10 · 3🔥 +20 · 4🔥 +40 (full Cup ride)
              </p>
              <p className="mt-1.5">
                Switch teams and the chain resets — but a new ride starts at 1×.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}