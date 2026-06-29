<?php

namespace App\Models;

use CodeIgniter\Model;

class DeletionAuditLogModel extends Model
{
    protected $table = 'deletion_audit_log';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id',
        'tenant_id',
        'requested_by_email',
        'status',
        'requested_at',
        'completed_at',
        'created_at',
        'updated_at',
    ];
    protected $useTimestamps = true;

    /**
     * Create a new deletion audit log entry
     */
    public function createEntry(string $tenantId, string $requestedByEmail): string
    {
        $id = $this->generateId();

        $this->insert([
            'id' => $id,
            'tenant_id' => $tenantId,
            'requested_by_email' => $requestedByEmail,
            'status' => 'requested',
            'requested_at' => date('Y-m-d H:i:s'),
            'completed_at' => null,
        ]);

        return $id;
    }

    /**
     * Get audit log entries by tenant
     */
    public function getByTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
                    ->orderBy('requested_at', 'DESC')
                    ->findAll();
    }

    /**
     * Get the most recent audit log entry for a tenant
     */
    public function getLatestByTenant(string $tenantId): ?array
    {
        return $this->where('tenant_id', $tenantId)
                    ->orderBy('requested_at', 'DESC')
                    ->first();
    }

    /**
     * Mark an entry as completed (deletion executed)
     */
    public function markCompleted(string $entryId): bool
    {
        return $this->update($entryId, [
            'status' => 'completed',
            'completed_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Mark an entry as canceled (undo deletion)
     */
    public function markCanceled(string $entryId): bool
    {
        return $this->update($entryId, [
            'status' => 'canceled',
            'completed_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Get all pending deletion requests
     */
    public function getPendingRequests(): array
    {
        return $this->where('status', 'requested')
                    ->findAll();
    }

    /**
     * Get audit log entries by status
     */
    public function getByStatus(string $status): array
    {
        return $this->where('status', $status)
                    ->orderBy('requested_at', 'DESC')
                    ->findAll();
    }

    /**
     * Generate a unique ID for the audit log entry
     */
    private function generateId(): string
    {
        return 'del_' . time() . '_' . bin2hex(random_bytes(4));
    }
}
