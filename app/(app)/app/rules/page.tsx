export default function RulesPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-safe">
      <header className="pt-4 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
          Rulebook
        </p>
        <h1 className="font-display text-2xl font-black tracking-tight">
          How it scores.
        </h1>
      </header>

      <Section title="The Bracket">
        <p>
          One pick per round. Get it right and you bank points. Re-pick
          the same team next round and they win again, your points
          <strong className="text-brand"> double</strong>. Keep riding
          and they keep doubling.
        </p>

        <ScoringTable
          rows={[
            ["🔥", "+10", "Pick a winner. Fresh pick or chain just started."],
            ["🔥🔥", "+20", "Rode the same team for 2 rounds in a row, both won."],
            ["🔥🔥🔥", "+40", "Rode the same team for 3 rounds, all won."],
            ["🔥🔥🔥🔥", "+80", "Rode the same team R1 → Cup. Maximum payoff."],
          ]}
        />

        <p className="text-ink-400">
          Switch teams and the chain resets — but a fresh ride starts
          at +10. Pick the wrong team and you get 0 for that round
          (the chain dies, you can start a new one next round).
        </p>
        <p className="text-ink-400">
          The math rewards conviction. Hedge and you collect crumbs.
          Call the long shot early and you <strong className="text-brand">vault the leaderboard</strong>.
        </p>
      </Section>

      <Section title="Live Props">
        <div className="space-y-3">
          <PropRow
            emoji="🎯"
            title="Grudge Match"
            reward="+5 pts"
            body="Pre-game H2H between two stars. Pick a side before puck drop. Ties pay 0."
          />
          <PropRow
            emoji="💥"
            title="Penalty Total"
            reward="+5 pts"
            body="Over/Under on total PIMs for a game. Pushes pay 0."
          />
        </div>
      </Section>

      <Section title="The Pot">
        <p>
          <strong className="text-ink-100">$100 entry · winner takes all.</strong>{" "}
          Entry must be paid before Round 1 puck drop. If you show up unpaid,
          your picks don&apos;t count toward the prize.
        </p>
        <p className="text-ink-400">
          Final tiebreaker: total reactions earned on the activity feed across the playoffs.
        </p>
      </Section>

      <Section title="Fair Play">
        <p>
          Picks lock at puck drop. Once locked, every pool member can see what
          everyone picked — Pulse tab shows the whole grid.
        </p>
        <p>
          The commissioner can manually override a score if the NHL API gets
          something wrong. All overrides are logged and visible.
        </p>
      </Section>

      <div className="py-10 text-center">
        <p className="text-xs text-ink-500">
          Built for the boys · 2026 playoffs
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-xl font-black tracking-tight">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-300">
        {children}
      </div>
    </section>
  );
}

function ScoringTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
      {rows.map(([round, mult, body], i) => (
        <div
          key={round}
          className={`flex gap-3 px-4 py-3 ${i < rows.length - 1 ? "border-b border-ink-700/60" : ""}`}
        >
          <div className="w-20 flex-shrink-0">
            <div className="font-display text-xs font-bold text-ink-400">{round}</div>
            <div className="font-display text-2xl font-black text-brand">{mult}</div>
          </div>
          <div className="flex-1 text-[13px] leading-relaxed text-ink-300">
            {body}
          </div>
        </div>
      ))}
    </div>
  );
}

function PropRow({
  emoji,
  title,
  reward,
  body,
}: {
  emoji: string;
  title: string;
  reward: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <span className="font-display text-[15px] font-bold">{title}</span>
        </div>
        <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-black text-brand">
          {reward}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-300">{body}</p>
    </div>
  );
}