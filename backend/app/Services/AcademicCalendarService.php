<?php

namespace App\Services;

/**
 * AcademicCalendarService
 *
 * Validates academic calendar state and determines whether charge generation
 * is permitted for a given term. All validation runs before any DB transaction.
 */
class AcademicCalendarService
{
    // ── Error code constants ──────────────────────────────────────────────────

    const TERM_MISMATCH       = 'TERM_MISMATCH';
    const CALENDAR_INCOMPLETE = 'CALENDAR_INCOMPLETE';
    const OUTSIDE_TERM_DATES  = 'OUTSIDE_TERM_DATES';
    const NEW_YEAR_DETECTED   = 'NEW_YEAR_DETECTED';
    const TERM_OVERLAP        = 'TERM_OVERLAP';

    // ── Core detection methods ────────────────────────────────────────────────

    /**
     * Return the term whose date range contains $today, or null if none does.
     */
    public function getCurrentTerm(array $calendar, string $today): ?array
    {
        foreach ($calendar['terms'] ?? [] as $term) {
            if ($today >= $term['start'] && $today <= $term['end']) {
                return $term;
            }
        }
        return null;
    }

    /**
     * Return a list of term names/ids that are missing start or end dates.
     * An empty array means the calendar is complete.
     */
    public function validateCalendarCompleteness(array $calendar): array
    {
        $missing = [];
        foreach ($calendar['terms'] ?? [] as $term) {
            if (empty($term['start']) || empty($term['end'])) {
                $missing[] = $term['name'] ?? ($term['id'] ?? 'Unknown term');
            }
        }
        return $missing;
    }

    /**
     * Validate that no term ends after the next term starts.
     * Returns an array of human-readable overlap error strings.
     */
    public function validateTermSequence(array $terms): array
    {
        $errors = [];
        for ($i = 0; $i < count($terms) - 1; $i++) {
            $currentEnd = $terms[$i]['end'];
            $nextStart  = $terms[$i + 1]['start'];
            if ($currentEnd >= $nextStart) {
                $errors[] = sprintf(
                    'Term overlap: "%s" (ends %s) overlaps with "%s" (starts %s)',
                    $terms[$i]['name'],
                    $currentEnd,
                    $terms[$i + 1]['name'],
                    $nextStart
                );
            }
        }
        return $errors;
    }

    /**
     * Return true when today's date is past the last term's end date.
     */
    public function isNewYear(array $calendar, string $today): bool
    {
        $terms = $calendar['terms'] ?? [];
        if (empty($terms)) {
            return false;
        }
        $lastTerm = end($terms);
        return $today > $lastTerm['end'];
    }

    // ── Charge generation validation ─────────────────────────────────────────

    /**
     * Determine whether charges may be generated for $requestedTermId.
     *
     * Returns a ChargeGenerationValidationResult array:
     *   allowed  (bool)
     *   reason   (string|null)  — one of the error code constants
     *   message  (string)
     *   currentTerm (array|null)
     *   requestedTerm (string)
     *   calendarStatus ('COMPLETE'|'INCOMPLETE')
     *   + optional keys: missingTerms, isNewYear, actionRequired
     */
    public function canGenerateCharges(array $calendar, string $requestedTermId): array
    {
        $today = date('Y-m-d');

        // 0. Check for completely unconfigured calendar (no terms at all)
        if (empty($calendar['terms'])) {
            return $this->buildResult(false, self::CALENDAR_INCOMPLETE, [
                'message'       => 'Academic calendar has not been configured. Please add term dates in Settings → Academic Calendar.',
                'requestedTerm' => $requestedTermId,
                'calendarStatus'=> 'INCOMPLETE',
                'missingTerms'  => ['All terms'],
            ]);
        }

        // 1. Calendar completeness check (terms exist but some are missing dates)
        $missingTerms = $this->validateCalendarCompleteness($calendar);
        if (!empty($missingTerms)) {
            return $this->buildResult(false, self::CALENDAR_INCOMPLETE, [
                'message'       => 'Academic calendar is incomplete. Please configure all term dates.',
                'requestedTerm' => $requestedTermId,
                'calendarStatus'=> 'INCOMPLETE',
                'missingTerms'  => $missingTerms,
            ]);
        }

        // 2. New year detection (date past last term end)
        if ($this->isNewYear($calendar, $today)) {
            return $this->buildResult(false, self::NEW_YEAR_DETECTED, [
                'message'       => 'The academic year has ended. Please update the calendar for the new year.',
                'requestedTerm' => $requestedTermId,
                'calendarStatus'=> 'COMPLETE',
                'isNewYear'     => true,
                'actionRequired'=> 'Update the academic calendar for the new year before generating charges.',
            ]);
        }

        // 3. Find the active term
        $currentTerm = $this->getCurrentTerm($calendar, $today);
        if ($currentTerm === null) {
            return $this->buildResult(false, self::OUTSIDE_TERM_DATES, [
                'message'       => 'Today\'s date falls outside all configured term date ranges.',
                'requestedTerm' => $requestedTermId,
                'calendarStatus'=> 'COMPLETE',
            ]);
        }

        // 4. Term mismatch check
        if ($currentTerm['id'] !== $requestedTermId) {
            return $this->buildResult(false, self::TERM_MISMATCH, [
                'message'       => "Charge generation is only allowed for {$currentTerm['name']} (current term).",
                'currentTerm'   => $currentTerm,
                'requestedTerm' => $requestedTermId,
                'calendarStatus'=> 'COMPLETE',
            ]);
        }

        // All checks passed
        return $this->buildResult(true, null, [
            'message'       => 'Charge generation is allowed.',
            'currentTerm'   => $currentTerm,
            'requestedTerm' => $requestedTermId,
            'calendarStatus'=> 'COMPLETE',
        ]);
    }

    // ── Calendar status summary ───────────────────────────────────────────────

    /**
     * Return a summary of the current calendar state (used by the
     * GET /api/settings/calendar-status endpoint).
     */
    public function getCalendarStatus(array $calendar): array
    {
        $today        = date('Y-m-d');
        $missingTerms = $this->validateCalendarCompleteness($calendar);
        $complete     = empty($missingTerms);
        $isNewYear    = $complete && $this->isNewYear($calendar, $today);
        $currentTerm  = ($complete && !$isNewYear) ? $this->getCurrentTerm($calendar, $today) : null;
        $canGenerate  = $complete && !$isNewYear && $currentTerm !== null;

        $blockingReason = null;
        if (!$complete) {
            $blockingReason = self::CALENDAR_INCOMPLETE;
        } elseif ($isNewYear) {
            $blockingReason = self::NEW_YEAR_DETECTED;
        } elseif ($currentTerm === null) {
            $blockingReason = self::OUTSIDE_TERM_DATES;
        }

        $result = [
            'canGenerateCharges' => $canGenerate,
            'calendarComplete'   => $complete,
            'isNewYear'          => $isNewYear,
            'blockingReason'     => $blockingReason,
            'currentTerm'        => $currentTerm,
            'today'              => $today,
        ];

        if (!$complete) {
            $result['missingTerms'] = $missingTerms;
        }

        if ($isNewYear) {
            $result['actionRequired'] = 'Update the academic calendar for the new year.';
        }

        return $result;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function buildResult(bool $allowed, ?string $reason, array $extra): array
    {
        return array_merge([
            'allowed'        => $allowed,
            'reason'         => $reason,
            'currentTerm'    => null,
            'requestedTerm'  => null,
            'calendarStatus' => 'COMPLETE',
        ], $extra);
    }
}
