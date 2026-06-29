<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * StudentStatusService
 *
 * Centralizes side-effects that must happen when a student's status changes.
 *
 * Currently handles:
 *  - Auto-deallocation of active transport assignments when a student
 *    transitions away from 'active' (FR-009..FR-013).
 *
 * The service is intentionally additive: existing controllers can call
 * `handleStatusChange()` after a successful status update, and the service
 * triggers downstream effects in the same transaction or as follow-on writes.
 */
class StudentStatusService
{
    /** Status that indicates the student is in good standing for transport. */
    public const ACTIVE = 'active';

    /** Statuses that should trigger transport deallocation. */
    public const NON_ACTIVE_STATUSES = ['inactive', 'transferred', 'dropped_out', 'graduated'];

    private BaseConnection $db;
    private TransportAssignmentService $transportService;

    public function __construct(
        ?BaseConnection $db = null,
        ?TransportAssignmentService $transportService = null
    ) {
        $this->db = $db ?? Database::connect();
        $this->transportService = $transportService ?? new TransportAssignmentService($this->db);
    }

    /**
     * Should the transition trigger transport deallocation?
     *
     * Rule: only when moving FROM 'active' TO any non-active status.
     * Reactivations (non-active → active) do NOT auto-create assignments.
     */
    public function shouldDeallocateTransport(?string $oldStatus, ?string $newStatus): bool
    {
        if ($oldStatus !== self::ACTIVE) {
            return false;
        }
        if ($newStatus === self::ACTIVE || $newStatus === null) {
            return false;
        }
        return in_array($newStatus, self::NON_ACTIVE_STATUSES, true);
    }

    /**
     * Apply transport-related side effects of a status change.
     *
     * Returns a small report describing what happened. Safe to call even if
     * no action is required (returns ['transportDeactivatedCount' => 0]).
     */
    public function handleStatusChange(
        string $tenantId,
        string $studentId,
        ?string $oldStatus,
        ?string $newStatus,
        ?string $effectiveDate = null
    ): array {
        if (!$this->shouldDeallocateTransport($oldStatus, $newStatus)) {
            return ['transportDeactivatedCount' => 0];
        }

        $count = $this->transportService->deactivateAllForStudent(
            $tenantId,
            $studentId,
            $effectiveDate
        );

        if ($count > 0) {
            log_message(
                'info',
                sprintf(
                    '[StudentStatusService] Auto-deallocated %d transport assignment(s) for student %s on status change %s -> %s',
                    $count,
                    $studentId,
                    (string) $oldStatus,
                    (string) $newStatus
                )
            );
        }

        return ['transportDeactivatedCount' => $count];
    }
}
