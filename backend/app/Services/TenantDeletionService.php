<?php

namespace App\Services;

use App\Models\TenantModel;
use App\Models\DeletionAuditLogModel;

class TenantDeletionService
{
    protected TenantModel $tenantModel;
    protected DeletionAuditLogModel $auditLogModel;
    protected EmailService $emailService;

    public function __construct()
    {
        $this->tenantModel = new TenantModel();
        $this->emailService = new EmailService();
        $this->auditLogModel = new DeletionAuditLogModel();
    }

    /**
     * Request account deletion for a tenant
     *
     * @param string $tenantId The tenant ID
     * @param string $requestedByEmail Email of the admin requesting deletion
     * @param bool $confirmDelete Must be true to proceed
     * @return array Result with status and message
     * @throws \InvalidArgumentException If confirmation is missing
     * @throws \RuntimeException If deletion already requested
     */
    public function requestDeletion(string $tenantId, string $requestedByEmail, bool $confirmDelete): array
    {
        // Validate confirmation
        if (!$confirmDelete) {
            throw new \InvalidArgumentException('confirmDelete must be true');
        }

        // Check if tenant already has a pending deletion
        $tenant = $this->tenantModel->find($tenantId);
        if (!$tenant) {
            throw new \RuntimeException('Tenant not found');
        }

        if ($tenant['deletion_requested_at'] !== null) {
            throw new \RuntimeException('Deletion already requested');
        }

        // Record deletion request timestamp
        $now = date('Y-m-d H:i:s');
        $this->tenantModel->update($tenantId, [
            'deletion_requested_at' => $now,
        ]);

        // Create audit log entry
        $this->auditLogModel->createEntry($tenantId, $requestedByEmail);

        // Calculate expiration date
        $expiresAt = (new \DateTime($now))->modify('+7 days')->format('c');
        $remainingDays = 7;

        // Send confirmation email — non-fatal if it fails
        $schoolName = $this->tenantModel->getSchoolName($tenant);
        $recipientName = $this->getRecipientName($tenant, $requestedByEmail);
        try {
            $this->emailService->sendDeletionRequestConfirmation(
                $requestedByEmail,
                $recipientName,
                $schoolName,
                $expiresAt
            );
        } catch (\Exception $e) {
            log_message('error', 'Deletion confirmation email failed for tenant ' . $tenantId . ': ' . $e->getMessage());
        }

        return [
            'success' => true,
            'tenantId' => $tenantId,
            'status' => 'pending_deletion',
            'requestedAt' => $now,
            'expiresAt' => $expiresAt,
            'remainingDays' => $remainingDays,
            'message' => 'Account deletion requested. You have 7 days to undo this request in Settings → Account.',
        ];
    }

    /**
     * Undo a deletion request during the grace period
     *
     * @param string $tenantId The tenant ID
     * @param bool $confirmUndo Must be true to proceed
     * @return array Result with status and message
     * @throws \InvalidArgumentException If confirmation is missing
     * @throws \RuntimeException If no pending deletion or grace period expired
     */
    public function undoDeletion(string $tenantId, bool $confirmUndo): array
    {
        // Validate confirmation
        if (!$confirmUndo) {
            throw new \InvalidArgumentException('confirmUndo must be true');
        }

        // Check if tenant exists and has a pending deletion
        $tenant = $this->tenantModel->find($tenantId);
        if (!$tenant) {
            throw new \RuntimeException('Tenant not found');
        }

        $deletionRequestedAt = $tenant['deletion_requested_at'];

        if ($deletionRequestedAt === null) {
            throw new \RuntimeException('No pending deletion request');
        }

        // Check if grace period has expired
        if ($this->tenantModel->isDeletionExpired($deletionRequestedAt)) {
            throw new \RuntimeException('Grace period has expired. Account may have been deleted.');
        }

        // Clear deletion request timestamp
        $this->tenantModel->update($tenantId, [
            'deletion_requested_at' => null,
        ]);

        // Mark audit log entry as canceled
        $latestEntry = $this->auditLogModel->getLatestByTenant($tenantId);
        if ($latestEntry && $latestEntry['status'] === 'requested') {
            $this->auditLogModel->markCanceled($latestEntry['id']);
        }

        return [
            'success' => true,
            'tenantId' => $tenantId,
            'status' => 'active',
            'deletionCanceled' => true,
            'restoredAt' => date('Y-m-d H:i:s'),
            'message' => 'Account deletion has been canceled. Your account is now fully restored.',
        ];
    }

    /**
     * Check if a tenant can undo their deletion request
     *
     * @param string $tenantId The tenant ID
     * @return bool True if deletion can be undone
     */
    public function canUndo(string $tenantId): bool
    {
        $tenant = $this->tenantModel->find($tenantId);

        if (!$tenant) {
            return false;
        }

        return $this->tenantModel->hasPendingDeletion($tenant['deletion_requested_at'] ?? null);
    }

    /**
     * Validate that confirmation flag is present and true
     *
     * @param mixed $confirmation The confirmation value
     * @param string $fieldName Field name for error message
     * @throws \InvalidArgumentException If confirmation is invalid
     */
    public function validateConfirmation(mixed $confirmation, string $fieldName = 'confirmation'): void
    {
        if ($confirmation !== true) {
            throw new \InvalidArgumentException("{$fieldName} must be true");
        }
    }

    /**
     * Get deletion status for a tenant
     *
     * @param string $tenantId The tenant ID
     * @return array Deletion status data
     */
    public function getDeletionStatus(string $tenantId): array
    {
        $tenant = $this->tenantModel->find($tenantId);

        if (!$tenant) {
            throw new \RuntimeException('Tenant not found');
        }

        return $this->tenantModel->formatDeletionStatus($tenant);
    }

    /**
     * Permanently delete a tenant and all associated data
     *
     * @param string $tenantId The tenant ID to delete
     * @return array Statistics about what was deleted
     * @throws \RuntimeException If deletion fails
     */
    public function permanentlyDeleteTenant(string $tenantId): array
    {
        $db = \Config\Database::connect();
        $stats = [
            'tenantId' => $tenantId,
            'tablesDeleted' => [],
            'totalRecords' => 0,
        ];

        try {
            $db->transStart();

            // Fetch tenant record for school name before purging data
            $tenant = $this->tenantModel->find($tenantId);
            if (!$tenant) {
                throw new \RuntimeException('Tenant not found');
            }

            // Mark audit log as completed before any rows are removed
            $latestEntry = $this->auditLogModel->getLatestByTenant($tenantId);
            if ($latestEntry && $latestEntry['status'] === 'requested') {
                $this->auditLogModel->markCompleted($latestEntry['id']);
            }

            // ── Operational tables to purge ───────────────────────────────────
            //
            // Deletion order: deepest child tables first, core entities last.
            //
            // The following platform-level tables are intentionally EXCLUDED and
            // their data is PRESERVED for billing history and admin reporting:
            //   - school_subscriptions   (billing history, plan analytics)
            //   - proration_calculations (billing calculation records)
            //   - deletion_audit_log     (audit trail for this deletion)
            //   - dashboard_kpi_metrics  (historical platform KPI snapshots)
            //
            // Because school_subscriptions has ON DELETE CASCADE from tenants,
            // the tenant row itself is NOT hard-deleted. Instead it is anonymised
            // and stamped with permanently_deleted_at so that FK references in
            // the preserved tables remain valid.
            $tablesToDelete = [
                // ── Transport (allocations/stops/periods before routes) ─────────
                'transport_student_allocations',
                'transport_stops',
                'transport_route_periods',
                'transport_routes',
                'transport_vehicles',
                'transport_drivers',

                // ── Fee campaigns ─────────────────────────────────────────────
                'campaign_students',
                'fee_campaigns',

                // ── Student leaf records ──────────────────────────────────────
                'student_attendance',
                'ledger_adjustments',
                'refunds',
                'reconciliation_audit_log',
                'billing_runs',
                'payments',
                'charges',
                'student_status_history',
                'student_profile_history',
                'enrollments',

                // ── Staff leaf records ────────────────────────────────────────
                'staff_attendance',
                'leave_requests',

                // ── User leaf records ─────────────────────────────────────────
                'user_tutorial_progress',
                'user_dashboard_preferences',
                'user_invitations',

                // ── Core entities ─────────────────────────────────────────────
                'students',
                'staff',
                'grade_levels',
                'classes',

                // ── App state ────────────────────────────────────────────────
                'onboarding_progress',
                'setup_guide_progress',

                // ── Config / settings ─────────────────────────────────────────
                'payment_categories',
                'fee_structures',
                'academic_calendars',
                'settings',

                // ── Users (after all user-child tables) ───────────────────────
                'users',
            ];

            foreach ($tablesToDelete as $table) {
                if ($db->tableExists($table)) {
                    $affected = $db->table($table)
                        ->where('tenant_id', $tenantId)
                        ->delete()
                        ? $db->affectedRows()
                        : 0;

                    if ($affected > 0) {
                        $stats['tablesDeleted'][$table] = $affected;
                        $stats['totalRecords'] += $affected;
                    }
                }
            }

            // ── Soft-purge the tenant row ─────────────────────────────────────
            // Anonymise PII so no personal data remains, but keep the row alive
            // so that preserved platform records (subscriptions, proration,
            // audit log, KPI snapshots) retain a valid FK reference.
            // Clear deletion_requested_at so the cron job will not re-process
            // this tenant on subsequent runs.
            // Preserve the school name for analytics before wiping settings.
            $schoolName = $this->tenantModel->getSchoolName($tenant);
            $this->tenantModel->update($tenantId, [
                'name'                    => '[Deleted]',
                'email'                   => null,
                'subdomain'               => null,
                'settings'                => '{}',
                'fee_structure'           => null,
                'academic_calendar'       => null,
                'payment_categories'      => null,
                'charge_generation_history' => '[]',
                'deletion_requested_at'   => null,
                'permanently_deleted_at'  => date('Y-m-d H:i:s'),
                'deleted_school_name'     => $schoolName,
            ]);

            $db->transComplete();

            return $stats;
        } catch (\Exception $e) {
            $db->transRollback();
            throw new \RuntimeException('Failed to delete tenant: ' . $e->getMessage());
        }
    }

    /**
     * Get all tenants with expired deletion requests (7+ days old)
     *
     * @return array List of tenants ready for deletion
     */
    public function getExpiredDeletions(): array
    {
        return $this->tenantModel->getExpiredDeletions();
    }

    /**
     * Get all tenants with pending deletion requests
     *
     * @return array List of tenants with pending deletion
     */
    public function getPendingDeletions(): array
    {
        return $this->tenantModel->getPendingDeletions();
    }

    /**
     * Get tenants that requested deletion exactly N days ago (for reminders)
     *
     * @param int $days Number of days ago
     * @return array List of tenants
     */
    public function getDeletionsRequestedDaysAgo(int $days): array
    {
        return $this->tenantModel->getDeletionsRequestedDaysAgo($days);
    }

    /**
     * Derive a recipient name for the confirmation email.
     * Falls back to the email address if no name is available.
     */
    private function getRecipientName(array $tenant, string $fallbackEmail): string
    {
        $settings = json_decode($tenant['settings'] ?? '{}', true);
        return $settings['adminName'] ?? $tenant['name'] ?? $fallbackEmail;
    }
}
