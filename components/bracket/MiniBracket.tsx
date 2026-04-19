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
  team_a_seed: number | null;
  team_b_seed: number | null;
  wins_a: number;
  wins_b: number;
  winner_id: string | null;
};

export default function MiniBracket({
  series,
  myPicks,
}: {
  series: Series[];
  myPicks: { series_id: string; picked_team_id: string }[];
}) {
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

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-gradient-to-b from-ink-900 to-ink-950">
      <div className="p-3">
        <div className="mb-2 text-center">
          <p className="font-display text-[9px] font-black uppercase tracking-[0.3em] text-brand">Stanley Cup</p>
          <p className="font-display text-[12px] font-black tracking-wide text-ink-100">Playoffs Bracket</p>
        </div>

        <div className="grid grid-cols-7 gap-1" style={{ height: "560px" }}>
          <Column label="R1" series={westR1} myPick={myPick} />
          <FlexColumn label="R2" cells={[westR2[0], westR2[1]]} myPick={myPick} />
          <FlexColumn label="WCF" cells={[westCF]} myPick={myPick} center />
          <CupColumn scf={scf} myPick={myPick} />
          <FlexColumn label="ECF" cells={[eastCF]} myPick={myPick} center />
          <FlexColumn label="R2" cells={[eastR2[0], eastR2[1]]} myPick={myPick} />
          <Column label="R1" series={eastR1} myPick={myPick} />
        </div>

        <div className="mt-2 flex items-center justify-between px-1 font-mono text-[8px] uppercase tracking-widest text-ink-500">
          <span>West</span>
          <span>East</span>
        </div>
      </div>
    </div>
  );
}

function Column({
  label,
  series,
  myPick,
}: {
  label: string;
  series: Series[];
  myPick: (sid: string) => string | undefined;
}) {
  return (
    <div className="flex flex-col">
      <RoundLabel label={label} />
      <div className="flex flex-1 flex-col justify-between gap-1">
        {series.map((s) => (
          <MatchupCell key={s.id} series={s} myPick={myPick(s.id)} />
        ))}
      </div>
    </div>
  );
}

function FlexColumn({
  label,
  cells,
  myPick,
  center,
}: {
  label: string;
  cells: (Series | undefined)[];
  myPick: (sid: string) => string | undefined;
  center?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <RoundLabel label={label} />
      <div className={cn("flex flex-1 flex-col gap-1", center ? "justify-center" : "justify-around")}>
        {cells.map((s, i) =>
          s ? <MatchupCell key={s.id} series={s} myPick={myPick(s.id)} /> : <EmptyCell key={i} />
        )}
      </div>
    </div>
  );
}

function CupColumn({ scf, myPick }: { scf: Series | undefined; myPick: (sid: string) => string | undefined }) {
  return (
    <div className="flex flex-col">
      <div className="mb-1 text-center font-mono text-[8px] font-black uppercase tracking-widest text-brand">Cup</div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full rounded-md border-2 border-brand/40 bg-gradient-to-b from-brand/10 to-transparent p-1">
          <div className="text-center font-display text-[7px] font-black uppercase leading-tight tracking-widest text-brand">
            Cup
          </div>
          <div className="mt-0.5">
            {scf ? <MatchupCell series={scf} myPick={myPick(scf.id)} /> : <EmptyCell />}
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
  return <div className="h-24 rounded-md border border-dashed border-ink-700/40 bg-ink-900/40" />;
}

function MatchupCell({
  series,
  myPick,
}: {
  series: Series;
  myPick?: string;
}) {
  const elim = (id?: string) => series.winner_id !== null && series.winner_id !== id;
  return (
    <div>
      <TeamBlock
        team={series.team_a}
        seed={series.team_a_seed}
        wins={series.wins_a}
        won={series.winner_id === series.team_a?.id}
        eliminated={elim(series.team_a?.id)}
        picked={myPick === series.team_a?.id}
        position="top"
      />
      <TeamBlock
        team={series.team_b}
        seed={series.team_b_seed}
        wins={series.wins_b}
        won={series.winner_id === series.team_b?.id}
        eliminated={elim(series.team_b?.id)}
        picked={myPick === series.team_b?.id}
        position="bottom"
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
  position,
}: {
  team: Team | null;
  seed: number | null;
  wins: number;
  won: boolean;
  eliminated: boolean;
  picked: boolean;
  position: "top" | "bottom";
}) {
  if (!team) return <div className="h-12" />;
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-between gap-0.5 border bg-ink-900/80 px-1 py-1",
        position === "top" ? (picked && !eliminated ? "rounded-t-md" : "rounded-t-md border-b-0") : "rounded-b-md",
        picked && !eliminated ? "border-brand" : eliminated ? "border-rink-red/30 bg-rink-red/[0.04]" : "border-ink-700/60"
      )}
    >
      <span className="font-mono text-[8px] font-black leading-none text-ink-500/80">
        {seed ? `#${seed}` : ""}
      </span>
      {team.logo_url ? (
        <img
          src={team.logo_url}
          alt=""
          className={cn("h-7 w-7 object-contain", eliminated && "opacity-25 grayscale")}
        />
      ) : (
        <div className="h-7 w-7 rounded-full bg-ink-700" />
      )}
      {eliminated && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[22px] font-black leading-none text-rink-red/70">×</span>
        </div>
      )}
      <div className="flex items-center gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn("h-1 w-1 rounded-full", i < wins ? (won ? "bg-brand" : "bg-ink-200") : "bg-ink-700/80")}
          />
        ))}
      </div>
    </div>
  );
}
