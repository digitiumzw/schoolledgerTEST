import { formatDistanceToNow, parseISO, isValid, format, isToday, isYesterday } from "date-fns";

/**
 * Check whether a date string or Date has no meaningful time component (midnight).
 * For strings, checks the raw ISO time portion to remain timezone-safe.
 * Used to suppress "00:00" for DATE-only database values.
 */
function isMidnight(date: string | Date): boolean {
  if (typeof date === "string") {
    return /T00:00:00([+-]|Z|$)/.test(date);
  }
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
}

/**
 * Format a date string or Date as a relative time string (e.g. "2 minutes ago").
 * Falls back to "Unknown time" for invalid inputs.
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "Unknown time";
  const parsed = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(parsed)) return "Unknown time";
  return formatDistanceToNow(parsed, { addSuffix: true });
}

/**
 * Format an activity timestamp for display with richer rules:
 * - < 1 day: relative (e.g., "2 minutes ago")
 * - Yesterday: "Yesterday at HH:mm" (or "Yesterday" for midnight dates)
 * - This year: "MMM d, HH:mm" (or "MMM d" for midnight dates)
 * - Other years: "MMM d, yyyy, hh:mm a" (or "MMM d, yyyy" for midnight dates)
 * Falls back to "Unknown time" if invalid/missing.
 */
export function formatActivityTime(date: string | Date | null | undefined): string {
  if (!date) return "Unknown time";
  const parsed = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(parsed)) return "Unknown time";

  const noTime = isMidnight(date);

  if (isToday(parsed)) {
    return noTime ? "Today" : formatDistanceToNow(parsed, { addSuffix: true });
  }
  if (isYesterday(parsed)) {
    return noTime ? "Yesterday" : `Yesterday at ${format(parsed, "HH:mm")}`;
  }

  const now = new Date();
  if (parsed.getFullYear() === now.getFullYear()) {
    return noTime ? format(parsed, "MMM d") : format(parsed, "MMM d, HH:mm");
  }
  return noTime ? format(parsed, "MMM d, yyyy") : format(parsed, "MMM d, yyyy, hh:mm a");
}
