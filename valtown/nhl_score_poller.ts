/**
 * SavPicks — NHL Score Poller
 *
 * Val Town HTTP-triggered cron job. Run every 10 seconds during game windows,
 * every 5 minutes otherwise.
 *
 * For each currently-live game:
 *   1. Fetch play-by-play from api-web.nhle.com
 *   2. POST a normalized payload to SavPicks /api/ingest/game-event
 *
 * Setup:
 *   - In val.town, create a new HTTP val, paste this code
 *   - Set env vars on the val: SAVPICKS_URL, INGEST_SHARED_SECRET
 *   - Set the val's trigger to "Interval" → every 10 seconds
 */

const SAVPICKS_URL = Deno.env.get("SAVPICKS_URL")!; // e.g. https://savpicks.vercel.app
const INGEST_SECRET = Deno.env.get("INGEST_SHARED_SECRET")!;

// NHL Edge API: returns today's schedule + live status
const SCHEDULE_URL = "https://api-web.nhle.com/v1/schedule/now";

export default async function () {
  try {
    const scheduleRes = await fetch(SCHEDULE_URL);
    const schedule = await scheduleRes.json();

    // Collect all live games across the game week
    const liveGames: any[] = [];
    for (const day of schedule.gameWeek ?? []) {
      for (const game of day.games ?? []) {
        if (game.gameState === "LIVE" || game.gameState === "CRIT") {
          liveGames.push(game);
        }
      }
    }

    if (liveGames.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "no live games" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const results = await Promise.allSettled(
      liveGames.map((g) => fetchAndIngest(g.id))
    );

    return new Response(
      JSON.stringify({
        ok: true,
        live_games: liveGames.length,
        results: results.map((r) => (r.status === "fulfilled" ? r.value : r.reason?.message ?? "err")),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? "unknown" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function fetchAndIngest(gameId: string | number) {
  const pbpUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`;
  const res = await fetch(pbpUrl);
  if (!res.ok) throw new Error(`nhl api ${res.status}`);
  const pbp = await res.json();

  const homeTeam = pbp.homeTeam?.abbrev;
  const awayTeam = pbp.awayTeam?.abbrev;
  const homeScore = pbp.homeTeam?.score ?? 0;
  const awayScore = pbp.awayTeam?.score ?? 0;

  // Extract goals in order
  const goalEvents = (pbp.plays ?? [])
    .filter((p: any) => p.typeDescKey === "goal")
    .map((p: any) => {
      const teamAbbrev = p.details?.eventOwnerTeamId === pbp.homeTeam?.id ? homeTeam : awayTeam;
      return {
        team_id: teamAbbrev,
        period: p.periodDescriptor?.number?.toString() ?? "?",
        clock: p.timeInPeriod ?? "",
        scorer_id: p.details?.scoringPlayerId?.toString() ?? null,
      };
    });

  // Sum PIMs
  const totalPim = (pbp.plays ?? [])
    .filter((p: any) => p.typeDescKey === "penalty")
    .reduce((sum: number, p: any) => sum + (p.details?.duration ?? 0), 0);

  const status =
    pbp.gameState === "FINAL" || pbp.gameState === "OFF"
      ? "final"
      : pbp.gameState === "LIVE" || pbp.gameState === "CRIT"
      ? "live"
      : "scheduled";

  const payload = {
    game_id: String(gameId),
    home_score: homeScore,
    away_score: awayScore,
    period: pbp.periodDescriptor?.number?.toString() ?? null,
    clock: pbp.clock?.timeRemaining ?? null,
    status,
    goal_events: goalEvents,
    total_pim: totalPim,
  };

  const ingest = await fetch(`${SAVPICKS_URL}/api/ingest/game-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ingest-secret": INGEST_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!ingest.ok) {
    throw new Error(`ingest ${ingest.status}: ${await ingest.text()}`);
  }

  return { game_id: gameId, status, goals: goalEvents.length };
}
