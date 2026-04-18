/**
 * Permissive type stub for initial scaffold.
 *
 * After first deploy, regenerate real types with:
 *   npx supabase gen types typescript --project-id ztqmhsloxraacdwwvxdc > lib/types/database.ts
 */

export type Conference = "EAST" | "WEST";
export type SeriesStatus = "upcoming" | "live" | "completed";
export type GameStatus = "scheduled" | "live" | "final";
export type PropType = "h2h_player" | "game_total_pim" | "next_team_to_score";
export type PropStatus = "open" | "locked" | "resolved" | "void";

export interface Profile {
  id: string;
  gamertag: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  full_name: string;
  city: string;
  short_name: string;
  conference: Conference;
  division: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  is_eliminated: boolean;
  eliminated_at: string | null;
}

export interface LeaderboardRow {
  user_id: string;
  gamertag: string;
  avatar_url: string | null;
  bracket_points: number;
  prop_points: number;
  adjustment_points: number;
  total_points: number;
  bracket_hits: number;
  bracket_resolved: number;
  prop_hits: number;
  prop_resolved: number;
  max_streak: number;
  rank: number;
}

export interface ActivityEvent {
  id: string;
  event_type:
    | "pick_placed"
    | "pick_hit"
    | "pick_miss"
    | "streak_milestone"
    | "goal_scored"
    | "series_clinched"
    | "new_leader"
    | "admin_announcement";
  actor_id: string | null;
  payload: Record<string, unknown>;
  importance: number;
  created_at: string;
}

// Permissive Database shape — replace with `supabase gen types` output post-deploy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
