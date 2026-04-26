"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, haptic } from "@/lib/utils";
import {
  ridersForCell,
  farthestPickRound,
  roundShortLabel,
  type StreakSeries,
  type StreakPick,
} from "@/lib/bracketStreaks";

type Team = { id: string; short_name?: string; logo_url: string | null };
type Series = {
  id: string;
  bracket_slot: string;
  conference: string;
  round: number;
  team_a: Team | null;
  team_b: Team | null;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_seed: number | null;
  team_b_seed: number | null;
  wins_a: number;
  wins_b: number;
  winner_id: string | null;
};

type Profile = { user_id: string; gamertag: string };

const CHIP_COLORS = ["bg-pink-600", "bg-rose-600", "bg-orange-600", "bg-amber-600", "bg-lime-600", "bg-emerald-600", "bg-teal-600", "bg-cyan-600", "bg-sky-600", "bg-indigo-600", "bg-violet-600", "bg-fuchsia-600"];

function chipColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h << 5) - h + userId.charCodeAt(i);
    h |= 0;
  }
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function MiniBracket({
  series,
  myPicks,
  allBracketPicks = [],
  profiles = [],
  currentUserId,
}: {
  series: Series[];
  myPicks: { series_id: string; picked_team_id: string }[];
  allBracketPicks?: StreakPick[];
  profiles?: Profile[];
  currentUserId?: string;
}) {
  const [drawer, setDrawer] = useState<{ teamId: string; teamLabel: string; round: number } | null>(null);

  const streakSeries: StreakSeries[] = useMemo(
    () =>
      series.map((s) => ({
        id: s.id,
        round: s.round,
        team_a_id: s.team_a_id,
        team_b_id: s.team_b_id,
        winner_id: s.winner_id,
      })),
    [series],
  );

  const myPick = (sid: string) => myPicks.find((p) => p.series_id === sid)?.picked_team_id;
  const isWest = (s: Series) => (s.conference ?? "").startsWith("W");
  const isEast = (s: Series) => (s.conference ?? "").startsWith("E");
  const bySlot = (a: Series, b: Series) => (a.bracket_slot ?? "").localeCompare(b.bracket_slot ?? "");

  const westR1 = series.filter((s) => s.round === 1 && isWest(s)).sort(bySlot);
  const eastR1 = series.filter((s) => s.round === 1 && isEast(s)).sort(bySlot);
  const westR2 = series.filter((s) => s.round === 2 && isWest(s)).sort(bySlot);
  const eastR2 = series.filter((s) => s.round === 2 && isEast(s)).sort(bySlot);
  const westCF = series.find((s) => s.round === 3 && isWest(s));
  const eastCF = series.find((s) => s.round === 3 && isEast(s));
  const scf = series.find((s) => s.round === 4);

  const onTeamTap = (teamId: string | null | undefined, teamLabel: string, round: number) => {
    if (!teamId) return;
    haptic("light");
    setDrawer({ teamId, teamLabel, round });
  };

  return (
    <>
      <div className="rounded-2xl border border-ink-700/70 bg-gradient-to-b from-ink-900 to-ink-950 shadow-tier-3">
        <div className="px-2 pt-3 pb-2">
          <div className="mb-2 text-center">
            <p className="font-display text-[9px] font-black uppercase tracking-[0.3em] text-brand">Stanley Cup</p>
            <p className="font-display text-[12px] font-black tracking-wide text-ink-100">Playoffs Bracket</p>
          </div>

          <div className="grid grid-cols-7 items-stretch gap-1">
            <Column label="R1" series={westR1} myPick={myPick} picks={allBracketPicks} streakSeries={streakSeries} onTeamTap={onTeamTap} />
            <FlexColumn label="R2" cells={[westR2[0], westR2[1]]} myPick={myPick} picks={allBracketPicks} streakSeries={streakSeries} onTeamTap={onTeamTap} />
            <FlexColumn label="WCF" cells={[westCF]} myPick={myPick} picks={allBracketPicks} streakSeries={streakSeries} onTeamTap={onTeamTap} center />
            <CupColumn scf={scf} myPick={myPick} picks={allBracketPicks} streakSeries={streakSeries} onTeamTap={onTeamTap} />
            <FlexColumn label="ECF" cells={[eastCF]} myPick={myPick} picks={allBracketPicks} streakSeries={streakSeries} onTeamTap={onTeamTap} center />
            <FlexColumn label="R2" cells={[eastR2[0], eastR2[1]]} myPick={myPick} picks={allBracketPicks} streakSeries={streakSeries} onTeamTap={onTeamTap} />
            <Column label="R1" series={eastR1} myPick={myPick} picks={allBracketPicks} streakSeries={streakSeries} onTeamTap={onTeamTap} />
          </div>

          <div className="mt-2 flex items-center justify-between px-1 font-mono text-[8px] uppercase tracking-widest text-ink-500">
            <span>West</span>
            <span>East</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drawer && (
          <OnTheRideDrawer
            teamId={drawer.teamId}
            teamLabel={drawer.teamLabel}
            round={drawer.round}
            picks={allBracketPicks}
            series={streakSeries}
            profiles={profiles}
            currentUserId={currentUserId}
            onClose={() => setDrawer(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

type ColumnProps = {
  label: string;
  series: Series[];
  myPick: (sid: string) => string | undefined;
  picks: StreakPick[];
  streakSeries: StreakSeries[];
  onTeamTap: (teamId: string | null | undefined, label: string, round: number) => void;
};

function Column({ label, series, myPick, picks, streakSeries, onTeamTap }: ColumnProps) {
  return (
    <div className="flex flex-col">
      <RoundLabel label={label} />
      <div className="flex flex-1 flex-col justify-between gap-6">
        {series.map((s) => (
          <MatchupCell key={s.id} series={s} myPick={myPick(s.id)} picks={picks} streakSeries={streakSeries} onTeamTap={onTeamTap} />
        ))}
      </div>
    </div>
  );
}

function FlexColumn({
  label,
  cells,
  myPick,
  picks,
  streakSeries,
  onTeamTap,
  center,
}: {
  label: string;
  cells: (Series | undefined)[];
  myPick: (sid: string) => string | undefined;
  picks: StreakPick[];
  streakSeries: StreakSeries[];
  onTeamTap: (teamId: string | null | undefined, label: string, round: number) => void;
  center?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <RoundLabel label={label} />
      <div className={cn("flex flex-1 flex-col gap-2", center ? "justify-center" : "justify-around")}>
        {cells.map((s, i) =>
          s ? <MatchupCell key={s.id} series={s} myPick={myPick(s.id)} picks={picks} streakSeries={streakSeries} onTeamTap={onTeamTap} /> : <EmptyCell key={i} />
        )}
      </div>
    </div>
  );
}

function CupColumn({
  scf,
  myPick,
  picks,
  streakSeries,
  onTeamTap,
}: {
  scf: Series | undefined;
  myPick: (sid: string) => string | undefined;
  picks: StreakPick[];
  streakSeries: StreakSeries[];
  onTeamTap: (teamId: string | null | undefined, label: string, round: number) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-1 text-center font-mono text-[8px] font-black uppercase tracking-widest text-brand">Cup</div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full rounded-md border-2 border-brand/40 bg-gradient-to-b from-brand/10 to-transparent p-1">
          <div className="text-center font-display text-[7px] font-black uppercase leading-tight tracking-widest text-brand">
            Cup
          </div>
          <div className="mt-0.5">
            {scf ? <MatchupCell series={scf} myPick={myPick(scf.id)} picks={picks} streakSeries={streakSeries} onTeamTap={onTeamTap} /> : <EmptyCell />}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundLabel({ label }: { label: string }) {
  return (
    <div className="mb-1 text-center font-mono text-[8px] font-black uppercase tracking-widest text-brand">
      {label}
    </div>
  );
}

function EmptyCell() {
  return <div className="h-[100px] rounded-md border border-dashed border-ink-700/40 bg-ink-900/40" />;
}

function MatchupCell({
  series,
  myPick,
  picks,
  streakSeries,
  onTeamTap,
}: {
  series: Series;
  myPick?: string;
  picks: StreakPick[];
  streakSeries: StreakSeries[];
  onTeamTap: (teamId: string | null | undefined, label: string, round: number) => void;
}) {
  const elim = (id?: string) => series.winner_id !== null && series.winner_id !== id;
  return (
    <div className="space-y-1.5">
      <TeamBlock
        team={series.team_a}
        seed={series.team_a_seed}
        wins={series.wins_a}
        won={series.winner_id === series.team_a?.id}
        eliminated={elim(series.team_a?.id)}
        picked={myPick === series.team_a?.id}
        round={series.round}
        picks={picks}
        streakSeries={streakSeries}
        onTeamTap={onTeamTap}
      />
      <TeamBlock
        team={series.team_b}
        seed={series.team_b_seed}
        wins={series.wins_b}
        won={series.winner_id === series.team_b?.id}
        eliminated={elim(series.team_b?.id)}
        picked={myPick === series.team_b?.id}
        round={series.round}
        picks={picks}
        streakSeries={streakSeries}
        onTeamTap={onTeamTap}
      />
    </div>
  );
}

function TeamBlock({
  team,
  seed,
  wins,
  won,
  eliminated,
  picked,
  round,
  picks,
  streakSeries,
  onTeamTap,
}: {
  team: Team | null;
  seed: number | null;
  wins: number;
  won: boolean;
  eliminated: boolean;
  picked: boolean;
  round: number;
  picks: StreakPick[];
  streakSeries: StreakSeries[];
  onTeamTap: (teamId: string | null | undefined, label: string, round: number) => void;
}) {
  if (!team) return <div className="h-12" />;

  const riders = useMemo(
    () => (eliminated ? [] : ridersForCell(team.id, round, picks, streakSeries)),
    [team.id, round, picks, streakSeries, eliminated],
  );
  const maxStreak = riders.length > 0 ? riders[0].streak : 0;

  const borderClass = picked && !eliminated
    ? "border-brand"
    : eliminated
    ? "border-rink-red bg-rink-red/10"
    : "border-ink-700/60";

  const stripBg = eliminated
    ? "bg-rink-red/15"
    : picked
    ? "bg-brand/15"
    : "bg-ink-800";

  const stripText = eliminated ? "text-rink-red" : picked ? "text-brand" : "text-ink-400";

  return (
    <button
      type="button"
      onClick={() => onTeamTap(team.id, team.short_name ?? team.id, round)}
      disabled={!team.id}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-md border bg-ink-900/80 text-left transition active:scale-[0.97]",
        borderClass,
      )}
    >
      <div className={cn("h-3.5 flex items-center justify-center leading-none", stripBg)}>
        <span className={cn("font-mono text-[8px] font-black leading-none", stripText)}>#{seed ?? "—"}</span>
      </div>

      <div className="relative h-7 overflow-hidden">
        {team.logo_url && (
          <img
            src={team.logo_url}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full scale-[2] object-contain",
              eliminated && "opacity-30"
            )}
          />
        )}
        {maxStreak > 0 && (
          <span className="absolute right-0 top-0 inline-flex items-center rounded-bl-md bg-ink-900/85 px-1 py-[1px] font-mono text-[8px] font-black leading-none text-amber-400 shadow-sm">
            {maxStreak}🔥
          </span>
        )}
      </div>

      <div className={cn("h-3.5 flex items-center justify-center gap-0.5 leading-none", stripBg)}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 w-1 rounded-full",
              i < wins ? (won ? "bg-brand" : eliminated ? "bg-rink-red" : "bg-ink-100") : "bg-ink-700"
            )}
          />
        ))}
      </div>
    </button>
  );
}

function OnTheRideDrawer({
  teamId,
  teamLabel,
  round,
  picks,
  series,
  profiles,
  currentUserId,
  onClose,
}: {
  teamId: string;
  teamLabel: string;
  round: number;
  picks: StreakPick[];
  series: StreakSeries[];
  profiles: Profile[];
  currentUserId?: string;
  onClose: () => void;
}) {
  const userMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.user_id, p.gamertag])),
    [profiles],
  );

  const riders = useMemo(() => {
    const base = ridersForCell(teamId, round, picks, series);
    return base.map((r) => {
      const farthest = farthestPickRound(r.user_id, teamId, picks, series);
      return { ...r, farthestRound: farthest };
    });
  }, [teamId, round, picks, series]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-ink-700 bg-ink-850 p-6 pb-10 shadow-tier-4"
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-ink-600" />
        <div className="mb-5">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-brand">On the Ride</p>
          <h2 className="mt-1 font-display text-[22px] font-black leading-tight tracking-tight text-ink-100">{teamLabel}</h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-500">
            {riders.length} {riders.length === 1 ? "rider" : "riders"} · {roundShortLabel(round)}
          </p>
        </div>

        {riders.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-8 text-center text-[12px] text-ink-500">
            Nobody&apos;s riding {teamLabel} alive in {roundShortLabel(round)}.
          </div>
        ) : (
          <div className="space-y-1.5">
            {riders.map((r) => {
              const name = userMap[r.user_id] ?? "?";
              const isMe = r.user_id === currentUserId;
              const through = roundShortLabel(r.farthestRound);
              return (
                <div
                  key={r.user_id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-ink-900/60 px-3 py-2.5",
                    isMe ? "border-brand/50" : "border-ink-700",
                  )}
                >
                  <div className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-full font-mono text-[11px] font-black text-white", chipColor(r.user_id))}>
                    {getInitials(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("truncate font-display text-[14px] font-bold leading-tight", isMe ? "text-brand" : "text-ink-100")}>{name}</span>
                      {isMe && <span className="font-mono text-[8px] font-black uppercase tracking-wider text-brand">YOU</span>}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Picked {teamLabel} through {through}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-0.5 font-mono text-[14px] leading-none text-amber-400" title={`${r.streak} flame${r.streak === 1 ? "" : "s"}`}>
                    {Array.from({ length: r.streak }).map((_, i) => (
                      <span key={i}>🔥</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-ink-700 bg-ink-800 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-300 transition active:scale-[0.98]"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}