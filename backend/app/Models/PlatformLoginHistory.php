<?php

namespace App\Models;

use CodeIgniter\Model;

class PlatformLoginHistory extends Model
{
    protected $table      = 'platform_login_history';
    protected $primaryKey = 'id';

    protected $allowedFields = [
        'platform_user_id', 'email_attempted', 'ip_address',
        'user_agent', 'outcome', 'failure_reason',
    ];

    protected $useTimestamps = false;

    public static function logAttempt(
        ?int    $platformUserId,
        string  $emailAttempted,
        string  $outcome,
        ?string $failureReason = null
    ): void {
        $request = service('request');
        $model   = new self();
        $model->insert([
            'platform_user_id' => $platformUserId,
            'email_attempted'  => $emailAttempted,
            'ip_address'       => $request->getIPAddress(),
            'user_agent'       => substr($request->getUserAgent()->getAgentString() ?? '', 0, 1000),
            'outcome'          => $outcome,
            'failure_reason'   => $failureReason,
            'created_at'       => date('Y-m-d H:i:s'),
        ]);
    }

    public function forUser(int $userId, int $limit = 20): array
    {
        return $this->where('platform_user_id', $userId)
                    ->orderBy('created_at', 'DESC')
                    ->limit($limit)
                    ->findAll();
    }
}
