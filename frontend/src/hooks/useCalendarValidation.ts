import { useMemo } from "react";
import { AcademicCalendar } from "@/types/dashboard";

export interface CalendarValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isNewYearDetected: boolean;
  isOutsideAllTerms: boolean;
  lastTermYear: number | null;
}

export function useCalendarValidation(calendar: AcademicCalendar | null): CalendarValidation {
  return useMemo((): CalendarValidation => {
    const result: CalendarValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      isNewYearDetected: false,
      isOutsideAllTerms: false,
      lastTermYear: null,
    };

    if (!calendar || !calendar.terms || calendar.terms.length === 0) {
      result.warnings.push("No terms configured. Please set up your academic calendar.");
      return result;
    }

    const currentYear = new Date().getFullYear();
    const today = new Date();

    const sortedTerms = [...calendar.terms].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    // Check for overlapping terms
    for (let i = 0; i < sortedTerms.length - 1; i++) {
      const currentEnd = new Date(sortedTerms[i].end);
      const nextStart = new Date(sortedTerms[i + 1].start);
      if (currentEnd >= nextStart) {
        result.errors.push(
          `Terms overlap: "${sortedTerms[i].name}" ends after "${sortedTerms[i + 1].name}" starts.`
        );
        result.isValid = false;
      }
    }

    // Check for invalid date ranges within terms
    for (const term of calendar.terms) {
      if (new Date(term.start) >= new Date(term.end)) {
        result.errors.push(`"${term.name}" has invalid dates: start date must be before end date.`);
        result.isValid = false;
      }
    }

    // Check if terms are outdated
    const latestTermEnd =
      sortedTerms.length > 0 ? new Date(sortedTerms[sortedTerms.length - 1].end) : null;

    if (latestTermEnd) {
      const latestYear = latestTermEnd.getFullYear();
      result.lastTermYear = latestYear;

      if (latestYear < currentYear) {
        result.isNewYearDetected = true;
        result.warnings.push(
          `New calendar year detected! Your term dates are from ${latestYear}. Please update term dates for ${currentYear}.`
        );
      }
    }

    // Check if current date falls outside all terms
    const isInAnyTerm = sortedTerms.some((term) => {
      const start = new Date(term.start);
      const end = new Date(term.end);
      return today >= start && today <= end;
    });

    if (!isInAnyTerm && !result.isNewYearDetected) {
      result.isOutsideAllTerms = true;
    }

    return result;
  }, [calendar]);
}
