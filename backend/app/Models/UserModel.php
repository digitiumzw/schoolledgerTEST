<?php

namespace App\Models;

use CodeIgniter\Model;

class UserModel extends Model
{
    protected $table            = 'users';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $allowedFields    = [
        'id', 'tenant_id', 'role', 'email', 'password',
        'name', 'status', 'is_temp_password', 'onboarding_complete',
        'created_at', 'updated_at',
    ];
    protected $useTimestamps = true;
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Find a user by their email address (case-insensitive).
     */
    public function findByEmail(string $email): ?array
    {
        return $this->where('LOWER(email)', strtolower($email))->first();
    }

    /**
     * Get all users belonging to a tenant.
     */
    public function getByTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
                    ->orderBy('name', 'ASC')
                    ->findAll();
    }

    /**
     * Authenticate a user with email + password.
     *
     * Only bcrypt-hashed passwords are accepted.  Plain-text passwords
     * stored in development seeds work via password_hash at seed time —
     * they should never bypass this check in production.
     *
     * Returns the user array on success, null on failure.
     */
    public function authenticate(string $email, string $password): ?array
    {
        if ($email === '' || $password === '') {
            return null;
        }

        $user = $this->findByEmail($email);
        if (!$user) {
            // Run a dummy verify to defeat timing-based user enumeration
            password_verify($password, '$2y$12$invalidhashfortimingprotection000000000000000000000000000');
            return null;
        }

        if (!password_verify($password, $user['password'])) {
            return null;
        }

        // Re-hash if the stored hash uses an outdated cost/algorithm
        if (password_needs_rehash($user['password'], PASSWORD_BCRYPT, ['cost' => 12])) {
            $this->update($user['id'], [
                'password' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            ]);
        }

        return $user;
    }
}
