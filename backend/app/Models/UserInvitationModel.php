<?php

namespace App\Models;

use CodeIgniter\Model;

class UserInvitationModel extends Model
{
    protected $table            = 'user_invitations';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'id',
        'tenant_id',
        'invited_user_id',
        'email',
        'name',
        'role',
        'invited_by',
        'token_hash',
        'expires_at',
        'accepted_at',
        'invalidated_at',
        'created_at',
    ];
    protected $useTimestamps = false;

    /**
     * Find the single active (non-accepted, non-invalidated, non-expired)
     * invitation matching the given token hash.
     */
    public function findActiveByTokenHash(string $tokenHash): ?array
    {
        return $this
            ->where('token_hash', $tokenHash)
            ->where('accepted_at IS NULL', null, false)
            ->where('invalidated_at IS NULL', null, false)
            ->where('expires_at >', date('Y-m-d H:i:s'))
            ->first();
    }

    /**
     * Find the most recent active invitation for a tenant + user pair.
     */
    public function findActiveForUser(string $tenantId, string $userId): ?array
    {
        return $this
            ->where('tenant_id', $tenantId)
            ->where('invited_user_id', $userId)
            ->where('accepted_at IS NULL', null, false)
            ->where('invalidated_at IS NULL', null, false)
            ->orderBy('created_at', 'DESC')
            ->first();
    }
}
