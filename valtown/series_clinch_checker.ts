/**
 * SavPicks — Series Clinch Checker
 *
 * Runs hourly during playoffs. For each series in SavPicks marked 'live' or 'upcoming',
 * check if one team has hit 4 wins. If so, POST to /api/ingest/series-result which
 * triggers the Postgres resolve_series() function (bracket scoring + activity events).
 *
 * Setup: HTTP val, Interval trigger "every 1 hour". Set env vars:
 *   SAVPICKS_URL, INGEST_SHARED_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SAVPICKS_URL = Deno.env.get("SAVPICKS_URL")!;
const INGEST_SECRET = Deno.env.get("INGEST_SHARED_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export default async function () {
  // Fetch all unfinished series from SavPicks DB
  const seriesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/series?status=in.(upcoming,live)&select=id,team_a_id,team_b_id,wins_a,wins_b`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const series: any[] = await seriesRes.json();

  const clinched = series.filter(
    (s) => (s.wins_a ?? 0) >= 4 || (s.wins_b ?? 0) >= 4
  );

  const results = [];
  for (const s of clinched) {
    const winner_team_id = (s.wins_a ?? 0) >= 4 ? s.team_a_id : s.team_b_id;
    const res = await fetch(`${SAVPICKS_URL}/api/ingest/series-result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-secret": INGEST_SECRET,
      },
      body: JSON.stringify({
        series_id: s.id,
        winner_team_id,
        wins_a: s.wins_a,
        wins_b: s.wins_b,
      }),
    });
    results.push({ series_id: s.id, ok: res.ok });
  }

  return new Response(
    JSON.stringify({ ok: true, checked: series.length, clinched: clinched.length, results }),
    { headers: { "Content-Type": "application/json" } }
  );
}
