import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPoints(points: number) {
  if (points >= 1000) return `${(points / 1000).toFixed(1)}k`;
  return points.toString();
}

export function formatRelativeTime(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Triggers the Taptic Engine on iOS Safari via Vibration API.
 * iOS Safari's VibrationAPI shim gives light/medium/heavy feedback
 * when a vibrate() call is made from a user gesture.
 */
export function haptic(kind: "light" | "medium" | "heavy" = "light") {
  if (typeof window === "undefined") return;
  const patterns = { light: 8, medium: 18, heavy: 32 };
  try {
    window.navigator.vibrate?.(patterns[kind]);
  } catch {
    // Silently ignore — unsupported browser
  }
}

/**
 * Compute the bracket multiplier preview in the UI
 * (mirrors the Postgres compute_bracket_streak function).
 * Returns 1, 2, 4, or 8.
 */
export function bracketMultiplier(streakLength: number) {
  return Math.pow(2, Math.max(0, streakLength - 1));
}
