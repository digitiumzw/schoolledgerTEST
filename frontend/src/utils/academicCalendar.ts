/**
 * Utility functions for academic calendar operations
 */

import { AcademicCalendar, Term } from "@/types/dashboard";

/**
 * Generates a deterministic term ID in the format YEAR-TERM_NAME
 * e.g. name="Term 2", startDate="2026-05-01" → "2026-TERM-2"
 * @param name      The term's display name
 * @param startDate ISO date string (YYYY-MM-DD) for the term start
 * @returns         ID string following the YEAR-TERM_NAME convention
 */
export function generateTermId(name: string, startDate: string): string {
  const year = startDate ? startDate.slice(0, 4) : new Date().getFullYear().toString();
  const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'TERM';
  return `${year}-${slug}`;
}

/**
 * Automatically detects the current term based on today's date and the academic calendar
 * @param calendar The academic calendar configured for the tenant
 * @returns The current term or null if no calendar/terms exist
 */
export function getCurrentTerm(calendar: AcademicCalendar | null): Term | null {
  if (!calendar || !calendar.terms || calendar.terms.length === 0) {
    return null;
  }

  const today = new Date();
  const todayString = today.toISOString().split('T')[0];

  // First try to find a term that contains today's date
  const currentTerm = calendar.terms.find(term => {
    return term.start <= todayString && todayString <= term.end;
  });

  // If found, return it
  if (currentTerm) {
    return currentTerm;
  }

  // If no current term found, find the next upcoming term
  const nextTerm = calendar.terms
    .filter(term => term.start > todayString)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];

  if (nextTerm) {
    return nextTerm;
  }

  // If no upcoming term, return the last term
  const lastTerm = calendar.terms
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];

  return lastTerm || null;
}

/**
 * Gets the academic year for a given term
 * @param term The term to get the academic year for
 * @returns The academic year string
 */
export function getAcademicYear(term: Term): string {
  // Try to extract year from term name or dates
  const yearMatch = term.name.match(/(\d{4})/);
  if (yearMatch) {
    return yearMatch[1];
  }

  // If no year in name, use the start date year
  return new Date(term.start).getFullYear().toString();
}

/**
 * Checks if a date is within a term
 * @param date The date to check
 * @param term The term to check against
 * @returns True if the date is within the term
 */
export function isDateInTerm(date: Date | string, term: Term): boolean {
  const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  return term.start <= dateString && dateString <= term.end;
}

/**
 * Gets all terms for a specific academic year
 * @param calendar The academic calendar
 * @param year The academic year to filter by
 * @returns Array of terms for the specified year
 */
export function getTermsByYear(calendar: AcademicCalendar | null, year: string): Term[] {
  if (!calendar || !calendar.terms) {
    return [];
  }

  return calendar.terms.filter(term => {
    const termYear = getAcademicYear(term);
    return termYear === year;
  });
}

/**
 * Returns the recommended active academic session based on the current system date.
 * For dates in January-August: returns current year / next year (e.g., "2025/2026")
 * For dates in September-December: returns next year / year after (e.g., "2026/2027")
 * This aligns with typical academic year cycles where the new academic year
 * starts around September.
 */
export function getRecommendedSession(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // September (9) onwards: recommend next academic year
  // January-August: recommend current academic year
  const startYear = month >= 9 ? year + 1 : year;
  return `${startYear}/${startYear + 1}`;
}

/**
 * Returns the list of selectable academic session strings spanning 3 years
 * back through 10 years ahead from the current year.
 * e.g. in 2026 returns ["2023/2024", "2024/2025", "2025/2026", "2026/2027",
 *                      "2027/2028", "2028/2029", "2029/2030", "2030/2031",
 *                      "2031/2032", "2032/2033", "2033/2034", "2034/2035",
 *                      "2035/2036", "2036/2037"]
 */
export function getSessionOptions(): string[] {
  const year = new Date().getFullYear();
  const offsets = [];
  for (let i = -3; i <= 10; i++) {
    offsets.push(i);
  }
  return offsets.map((offset) => {
    const y = year + offset;
    return `${y}/${y + 1}`;
  });
}

/**
 * Gets the next term after a given term
 * @param calendar The academic calendar
 * @param currentTerm The current term
 * @returns The next term or null if none
 */
export function getNextTerm(calendar: AcademicCalendar | null, currentTerm: Term): Term | null {
  if (!calendar || !calendar.terms) {
    return null;
  }

  const sortedTerms = calendar.terms.sort((a, b) => 
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const currentIndex = sortedTerms.findIndex(term => term.id === currentTerm.id);
  
  if (currentIndex < sortedTerms.length - 1) {
    return sortedTerms[currentIndex + 1];
  }

  return null;
}
