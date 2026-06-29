<?php

namespace App\Models;

use CodeIgniter\Model;

class SubscriptionGraceUsageModel extends Model
{
    protected $table            = 'subscription_grace_usage';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'id', 'tenant_id', 'hour_bucket', 'used_seconds', 'last_heartbeat',
    ];

    /**
     * Returns the current clock-hour bucket string (YYYYMMDDHH).
     */
    public static function currentBucket(): string
    {
        return date('YmdH');
    }

    /**
     * Fetch the usage row for the given tenant + hour bucket, creating it if absent.
     */
    public function getOrCreate(string $tenantId, string $bucket): array
    {
        $row = $this->where('tenant_id', $tenantId)
                    ->where('hour_bucket', $bucket)
                    ->first();

        if ($row !== null) {
            return $row;
        }

        $id  = 'sgu_' . time() . '_' . bin2hex(random_bytes(4));
        $now = date('Y-m-d H:i:s');

        $this->db->query(
            'INSERT IGNORE INTO subscription_grace_usage
             (id, tenant_id, hour_bucket, used_seconds, last_heartbeat, created_at, updated_at)
             VALUES (?, ?, ?, 0, NULL, ?, ?)',
            [$id, $tenantId, $bucket, $now, $now]
        );

        // Re-fetch in case another request inserted concurrently
        return $this->where('tenant_id', $tenantId)
                    ->where('hour_bucket', $bucket)
                    ->first();
    }

    /**
     * Atomically increment used_seconds and update last_heartbeat.
     */
    public function addSeconds(string $id, int $seconds, string $now): void
    {
        $this->db->query(
            'UPDATE subscription_grace_usage
             SET used_seconds = used_seconds + ?, last_heartbeat = ?, updated_at = ?
             WHERE id = ?',
            [$seconds, $now, $now, $id]
        );
    }
}
