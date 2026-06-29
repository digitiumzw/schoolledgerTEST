<?php

namespace App\Models;

use CodeIgniter\Model;

class TenantModel extends Model
{
    protected $table = 'tenants';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'name', 'email', 'subdomain', 'status',
        'charge_generation_history', 'settings', 'fee_structure',
        'academic_calendar', 'payment_categories',
        'deletion_requested_at', 'permanently_deleted_at', 'deleted_school_name',
        'created_at', 'updated_at',
    ];
    protected $useTimestamps = true;

    public function formatForApi(array $tenant): array
    {
        // Get school name from settings
        $settings = json_decode($tenant['settings'] ?? '{}', true);
        $schoolName = $settings['schoolName'] ?? 'Unknown School';
        
        return [
            'id' => $tenant['id'],
            'name' => $schoolName, // Keep 'name' for API compatibility
            'schoolName' => $schoolName, // Add explicit schoolName field
            'studentCount' => $this->getStudentCount($tenant['id']), // Calculate dynamically
            'alertsDismissed' => [], // Default empty array for compatibility
            'chargeGenerationHistory' => json_decode($tenant['charge_generation_history'] ?? '[]', true),
        ];
    }

    public function getStudentCount(string $tenantId): int
    {
        $studentModel = new \App\Models\StudentModel();
        return $studentModel->where('tenant_id', $tenantId)
                            ->where('status', 'active')
                            ->countAllResults();
    }

    /**
     * Get tenants with pending deletion status
     */
    public function getPendingDeletions(): array
    {
        return $this->where('deletion_requested_at IS NOT NULL')
                    ->where('permanently_deleted_at IS NULL')
                    ->where('deletion_requested_at >', date('Y-m-d H:i:s', strtotime('-7 days')))
                    ->findAll();
    }

    /**
     * Get tenants with expired deletion requests (7+ days old) that have not yet been purged
     */
    public function getExpiredDeletions(): array
    {
        return $this->where('deletion_requested_at IS NOT NULL')
                    ->where('permanently_deleted_at IS NULL')
                    ->where('deletion_requested_at <=', date('Y-m-d H:i:s', strtotime('-7 days')))
                    ->findAll();
    }

    /**
     * Get tenants with deletion requested exactly N days ago that have not yet been purged
     */
    public function getDeletionsRequestedDaysAgo(int $days): array
    {
        $targetDate = date('Y-m-d', strtotime("-{$days} days"));
        return $this->where('DATE(deletion_requested_at)', $targetDate)
                    ->where('permanently_deleted_at IS NULL')
                    ->findAll();
    }

    /**
     * Whether a tenant's operational data has been permanently purged
     */
    public function isPermanentlyDeleted(array $tenant): bool
    {
        return isset($tenant['permanently_deleted_at']) && $tenant['permanently_deleted_at'] !== null;
    }

    /**
     * Calculate remaining days in grace period
     */
    public function getRemainingDays(?string $deletionRequestedAt): ?int
    {
        if ($deletionRequestedAt === null) {
            return null;
        }

        $requestedAt = new \DateTime($deletionRequestedAt);
        $expiresAt = (clone $requestedAt)->modify('+7 days');
        $now = new \DateTime();

        if ($now >= $expiresAt) {
            return 0;
        }

        return (int) $now->diff($expiresAt)->days;
    }

    /**
     * Check if deletion has expired (7+ days since request)
     */
    public function isDeletionExpired(?string $deletionRequestedAt): bool
    {
        if ($deletionRequestedAt === null) {
            return false;
        }

        $requestedAt = new \DateTime($deletionRequestedAt);
        $expiresAt = (clone $requestedAt)->modify('+7 days');
        $now = new \DateTime();

        return $now >= $expiresAt;
    }

    /**
     * Check if tenant has a pending deletion request
     */
    public function hasPendingDeletion(?string $deletionRequestedAt): bool
    {
        return $deletionRequestedAt !== null && !$this->isDeletionExpired($deletionRequestedAt);
    }

    /**
     * Format tenant data with deletion status for API
     */
    public function formatDeletionStatus(array $tenant): array
    {
        $deletionRequestedAt = $tenant['deletion_requested_at'] ?? null;
        $remainingDays = $this->getRemainingDays($deletionRequestedAt);

        return [
            'tenantId' => $tenant['id'],
            'tenantName' => $this->getSchoolName($tenant),
            'deletionRequested' => $deletionRequestedAt !== null,
            'requestedAt' => $deletionRequestedAt,
            'expiresAt' => $deletionRequestedAt ? (new \DateTime($deletionRequestedAt))->modify('+7 days')->format('c') : null,
            'remainingDays' => $remainingDays,
            'canUndo' => $remainingDays !== null && $remainingDays > 0,
            'accountStatus' => $deletionRequestedAt !== null ? 'pending_deletion' : 'active',
        ];
    }

    /**
     * Get school name from tenant data
     */
    public function getSchoolName(array $tenant): string
    {
        $settings = json_decode($tenant['settings'] ?? '{}', true);
        return $settings['schoolName'] ?? $tenant['name'] ?? 'Unknown School';
    }
}
