"use client";

import { cn } from "@/lib/utils";

type Team = { id: string; logo_url: string | null };
type Series = {
  id: string;
  bracket_slot: string;
  conference: string;
  round: number;
  team_a: Team | null;
  team_b: Team | null;
  wins_a: number;
  wins_b: number;
  winner_id: string | null;
  status: string;
};

export default function MiniBracket({ series, myPicks }: { series: Series[]; myPicks: { series_id: string; picked_team_id: string }[] }) {
  const r1 = series.filter((s) => s.round === 1);
  const east = r1.filter((s) => (s.conference ?? "").startsWith("E")).sort((a, b) => a.bracket_slot.localeCompare(b.bracket_slot));
  const west = r1.filter((s) => (s.conference ?? "").startsWith("W")).sort((a, b) => a.bracket_slot.localeCompare(b.bracket_slot));
  const myPick = (sid: string) => myPicks.find((p) => p.series_id === sid)?.picked_team_id;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-850 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-ink-400">Round 1 Bracket</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-500">Best of 7</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Column label="East" series={east} myPick={myPick} />
        <Column label="West" series={west} myPick={myPick} />
      </div>
    </div>
  );
}

function Column({ label, series, myPick }: { label: string; series: Series[]; myPick: (sid: string) => string | undefined }) {
  return (
    <div>
      <div className="mb-1.5 text-center font-mono text-[9px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="space-y-1.5">
        {series.map((s) => (
          <Cell key={s.id} series={s} pickedTeam={myPick(s.id)} />
        ))}
      </div>
    </div>
  );
}

function Cell({ series, pickedTeam }: { series: Series; pickedTeam?: string }) {
  const elim = (id?: string) => series.winner_id !== null && series.winner_id !== id;
  return (
    <div className="overflow-hidden rounded-lg border border-ink-700/60 bg-ink-900/40">
      <Row team={series.team_a} wins={series.wins_a} won={series.winner_id === series.team_a?.id} eliminated={elim(series.team_a?.id)} picked={pickedTeam === series.team_a?.id} />
      <div className="h-px bg-ink-700/40" />
      <Row team={series.team_b} wins={series.wins_b} won={series.winner_id === series.team_b?.id} eliminated={elim(series.team_b?.id)} picked={pickedTeam === series.team_b?.id} />
    </div>
  );
}

function Row({ team, wins, won, eliminated, picked }: { team: Team | null; wins: number; won: boolean; eliminated: boolean; picked: boolean }) {
  if (!team) return <div className="h-7" />;
  return (
    <div className={cn("flex items-center gap-1.5 px-1.5 py-1", picked && !eliminated && "bg-brand/10")}>
      {team.logo_url ? (
        <img src={team.logo_url} alt="" className={cn("h-5 w-5 flex-none object-contain", eliminated && "opacity-25 grayscale")} />
      ) : (
        <div className="h-5 w-5 flex-none rounded-full bg-ink-700" />
      )}
      <div className="flex flex-1 items-center justify-end gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1 w-1 rounded-full", i < wins ? (won ? "bg-brand" : "bg-ink-300") : "bg-ink-700")} />
        ))}
      </div>
      {picked && (
        <span className={cn("font-mono text-[8px] font-black", eliminated ? "text-loss" : "text-brand")}>
          {eliminated ? "✗" : "✓"}
        </span>
      )}
    </div>
  );
}
