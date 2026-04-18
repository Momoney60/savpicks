# SavPicks

Private playoff pool — Next.js + Supabase + Upstash + Val Town.

## Stack

- **Frontend:** Next.js 14 (App Router), Tailwind, Framer Motion
- **Database/Auth:** Supabase
- **Live state:** Upstash Redis (pub/sub + low-latency counters)
- **Data ingestion:** Val Town (10s cron during games hitting the NHL Edge API)
- **Hosting:** Vercel

## Local dev

```bash
npm install
cp .env.local.example .env.local
# fill in keys
npm run dev
```

## Routes

- `/` — marketing landing + auth
- `/app/pulse` — leaderboard, activity feed, hot streaks
- `/app/bracket` — swipeable series picks with multiplier preview
- `/app/live` — live games, open props, reaction layer
- `/app/rules` — scoring model + payouts
- `/admin` — commissioner dashboard (is_admin gate)

## Database

Managed via Supabase migrations. See `supabase/migrations/` (if cloned from Supabase CLI) or the migration names in the Supabase dashboard:

1. `001_extensions_and_profiles`
2. `002_teams_and_players`
3. `003_series_and_bracket_picks`
4. `004_games_props_and_prop_picks`
5. `005_social_reactions_feed_chat`
6. `006_score_adjustments`
7. `007_updated_at_trigger`
8. `008_bracket_scoring_functions`
9. `009_prop_scoring_function`
10. `010_leaderboard_and_activity_triggers`
11. `011_seed_nhl_teams`
12. `012_row_level_security`

## Ingest endpoints

Val Town cron jobs POST to:

- `POST /api/ingest/game-event` — live score updates during games (every 10s)
- `POST /api/ingest/series-result` — called when a series clinches (resolves bracket picks)

Both require `x-ingest-secret` header matching `INGEST_SHARED_SECRET`.
