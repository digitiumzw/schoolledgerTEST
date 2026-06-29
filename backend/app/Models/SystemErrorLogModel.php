<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * SystemErrorLogModel — persists caught server exceptions for platform diagnostics.
 *
 * Each row maps to a Correlation ID returned to API clients in HTTP 500 responses.
 * Contains no business logic; use ExceptionHandler for write operations.
 */
class SystemErrorLogModel extends Model
{
    protected $table            = 'system_error_logs';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $useTimestamps    = false;

    protected $allowedFields = [
        'id',
        'correlation_id',
        'tenant_id',
        'user_id',
        'exception_class',
        'message',
        'stack_trace',
        'request_uri',
        'request_method',
        'ip_address',
        'created_at',
    ];

    public function logException(array $data): bool
    {
        return (bool) $this->insert($data, false);
    }

    public function findByCorrelationId(string $correlationId): ?array
    {
        return $this->where('correlation_id', $correlationId)->first() ?: null;
    }

    public function purgeOldLogs(int $retentionDays = 365): int
    {
        $cutoff = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));
        $this->where('created_at <', $cutoff)->delete();
        return $this->db->affectedRows();
    }
}
