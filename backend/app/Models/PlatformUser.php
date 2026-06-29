<?php

namespace App\Models;

use CodeIgniter\Model;

class PlatformUser extends Model
{
    protected $table      = 'platform_users';
    protected $primaryKey = 'id';

    protected $allowedFields = [
        'name', 'email', 'password_hash', 'platform_role',
        'last_login_at', 'status',
    ];

    protected $useTimestamps = true;

    protected $validationRules = [
        'name'          => 'required|max_length[255]',
        'email'         => 'required|valid_email|max_length[255]',
        'platform_role' => 'required|in_list[Owner,Admin,Finance,Support]',
        'status'        => 'permit_empty|in_list[Active,Invited,Deactivated]',
    ];

    public function findByEmail(string $email): ?array
    {
        return $this->where('email', $email)->first();
    }

    public function updateLastLogin(int $id): void
    {
        $this->update($id, ['last_login_at' => date('Y-m-d H:i:s')]);
    }

    public function deactivate(int $id): void
    {
        $this->update($id, ['status' => 'Deactivated']);
    }

    public function activate(int $id): void
    {
        $this->update($id, ['status' => 'Active']);
    }

    public function tombstoneAuditEntries(int $id): void
    {
        $db = \Config\Database::connect();
        $db->table('platform_audit')
            ->where('actor_user_id', $id)
            ->update(['actor_name' => '[Removed Admin]']);
    }

    public function byRole(string $role): self
    {
        return $this->where('platform_role', $role);
    }
}
