<?php

namespace App\Controllers\Platform;

use App\Libraries\AuditService;
use App\Libraries\FrontendUrl;
use App\Models\PlatformSetting;
use App\Models\PlatformUser;
use App\Services\EmailService;

class SettingsController extends BasePlatformController
{
    private PlatformSetting $settingModel;
    private PlatformUser $userModel;

    private const OWNER_ONLY_SETTING_KEYS = [
        'auto_suspend_failed_payment_threshold',
        'weekly_security_digest_enabled',
    ];

    public function __construct()
    {
        $this->settingModel = new PlatformSetting();
        $this->userModel    = new PlatformUser();
    }

    public function index()
    {
        return $this->success($this->settingModel->getAll());
    }

    public function update($id = null)
    {
        $role = $this->getPlatformRole();
        if (!$this->canManageSettings($role)) {
            return $this->forbidden('Only Owner or Admin can update platform settings.');
        }

        $body = $this->getRequestBody();

        // Owner-only keys
        foreach (self::OWNER_ONLY_SETTING_KEYS as $key) {
            if (array_key_exists($key, $body) && !$this->canManagePlatformSecurity($role)) {
                return $this->forbidden('Only Owner can change platform-wide security settings.');
            }
        }

        foreach ($body as $key => $item) {
            if (!is_array($item) || !isset($item['value'])) continue;

            $type = $item['type'] ?? 'string';
            $desc = $item['description'] ?? '';
            $this->settingModel->setSetting($key, $item['value'], $type, $desc);
        }

        AuditService::logFromRequest('platform.settings.update', null, null, array_keys($body));

        return $this->success($this->settingModel->getAll(), 'Settings updated');
    }

    // ─── Account (own) ────────────────────────────────────────────────────────

    public function updateAccount()
    {
        $userId = $this->getPlatformUserId();
        if (!$userId) return $this->error('Unauthenticated.', 401);

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['name', 'email']);
        if ($err) return $err;

        $name  = $this->sanitiseString($body['name']);
        $email = strtolower($this->sanitiseString($body['email']));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error('Please provide a valid email address.', 400);
        }

        $existing = $this->userModel->findByEmail($email);
        if ($existing && (int) $existing['id'] !== $userId) {
            return $this->error('That email is already in use.', 409);
        }

        $current = $this->userModel->find($userId);
        $this->userModel->update($userId, ['name' => $name, 'email' => $email]);

        AuditService::logFromRequest('platform.account.update', 'platform_user', $userId, [
            'from' => ['name' => $current['name'], 'email' => $current['email']],
            'to'   => ['name' => $name, 'email' => $email],
        ]);

        $updated = $this->userModel->find($userId);
        unset($updated['password_hash']);
        return $this->success($updated, 'Profile updated');
    }

    public function updatePassword()
    {
        $userId = $this->getPlatformUserId();
        if (!$userId) return $this->error('Unauthenticated.', 401);

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['current_password', 'new_password', 'new_password_confirmation']);
        if ($err) return $err;

        if ($body['new_password'] !== $body['new_password_confirmation']) {
            return $this->error('Passwords do not match.', 400);
        }
        if (strlen($body['new_password']) < 8) {
            return $this->error('New password must be at least 8 characters.', 400);
        }

        $user = $this->userModel->find($userId);
        if (!$user || !password_verify($body['current_password'], $user['password_hash'])) {
            return $this->error('Current password is incorrect.', 401);
        }

        $this->userModel->update($userId, [
            'password_hash' => password_hash($body['new_password'], PASSWORD_BCRYPT, ['cost' => 12]),
        ]);

        AuditService::logFromRequest('platform.account.password_change', 'platform_user', $userId);

        return $this->success(null, 'Password changed');
    }

    // ─── Team ─────────────────────────────────────────────────────────────────

    public function team()
    {
        // All roles can view the team list; write actions are gated separately.
        $members = $this->userModel->findAll();
        foreach ($members as &$m) {
            unset($m['password_hash']);
        }
        return $this->success($members);
    }

    public function inviteTeamMember()
    {
        if (!$this->canManageTeam($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['name', 'email', 'platform_role']);
        if ($err) return $err;

        $email = strtolower($this->sanitiseString($body['email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error('Please provide a valid email address.', 400);
        }

        $validRoles = ['Owner', 'Admin', 'Finance', 'Support'];
        if (!in_array($body['platform_role'], $validRoles, true)) {
            return $this->error('Invalid role.', 400);
        }

        if ($this->userModel->findByEmail($email)) {
            return $this->error('A team member with this email already exists.', 409);
        }

        $db = \Config\Database::connect();
        $db->transStart();

        $userId = $this->userModel->insert([
            'name'          => $this->sanitiseString($body['name']),
            'email'         => $email,
            'password_hash' => '',
            'platform_role' => $body['platform_role'],
            'status'        => 'Invited',
        ], true);

        $plainToken = bin2hex(random_bytes(32));
        $tokenHash  = hash('sha256', $plainToken);

        $db->table('platform_invitations')->insert([
            'platform_user_id' => $userId,
            'invited_by'       => $this->getPlatformUserId(),
            'token_hash'       => $tokenHash,
            'expires_at'       => date('Y-m-d H:i:s', time() + 48 * 3600),
            'created_at'       => date('Y-m-d H:i:s'),
        ]);

        $db->transComplete();

        $inviteLink = FrontendUrl::to('platform-control-panel/accept-invite?token=' . $plainToken);

        try {
            (new EmailService())->sendInvitation($email, $body['name'], $email, $inviteLink);
        } catch (\Throwable $e) {
            log_message('error', '[Platform.Invite] Email send failed: ' . $e->getMessage());
        }

        AuditService::logFromRequest('platform.team.invite', 'platform_user', $userId, [
            'email' => $email,
            'role'  => $body['platform_role'],
        ]);

        $member = $this->userModel->find($userId);
        unset($member['password_hash']);

        return $this->created($member, 'Invitation sent');
    }

    public function resendInvite($id)
    {
        if (!$this->canManageTeam($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $member = $this->userModel->find($id);
        if (!$member) return $this->notFound('Team member not found.');
        if (($member['status'] ?? 'Active') !== 'Invited') {
            return $this->error('This member has already accepted their invitation.', 409);
        }

        $db = \Config\Database::connect();
        $db->transStart();

        $db->table('platform_invitations')
            ->where('platform_user_id', $id)
            ->where('accepted_at IS NULL', null, false)
            ->update(['expires_at' => date('Y-m-d H:i:s', time() - 60)]);

        $plainToken = bin2hex(random_bytes(32));
        $tokenHash  = hash('sha256', $plainToken);
        $db->table('platform_invitations')->insert([
            'platform_user_id' => $id,
            'invited_by'       => $this->getPlatformUserId(),
            'token_hash'       => $tokenHash,
            'expires_at'       => date('Y-m-d H:i:s', time() + 48 * 3600),
            'created_at'       => date('Y-m-d H:i:s'),
        ]);

        $db->transComplete();

        $inviteLink = FrontendUrl::to('platform-control-panel/accept-invite?token=' . $plainToken);

        try {
            (new EmailService())->sendInvitation($member['email'], $member['name'], $member['email'], $inviteLink);
        } catch (\Throwable $e) {
            log_message('error', '[Platform.ResendInvite] Email send failed: ' . $e->getMessage());
        }

        AuditService::logFromRequest('platform.team.resend_invite', 'platform_user', $id);

        return $this->success(null, 'Invitation resent');
    }

    public function deactivateTeamMember($id)
    {
        if (!$this->canDeactivateTeamMember($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $id = (int) $id;
        if ($id === $this->getPlatformUserId()) {
            return $this->error('You cannot deactivate yourself.', 409);
        }

        $member = $this->userModel->find($id);
        if (!$member) return $this->notFound('Team member not found.');

        if ($member['platform_role'] === 'Owner' && ($member['status'] ?? 'Active') === 'Active') {
            $activeOwners = (int) $this->userModel
                ->where('platform_role', 'Owner')
                ->where('status', 'Active')
                ->countAllResults();
            if ($activeOwners <= 1) {
                return $this->error('Cannot deactivate the only active Owner.', 409);
            }
        }

        $this->userModel->deactivate($id);
        AuditService::logFromRequest('platform.team.deactivate', 'platform_user', $id, [
            'email' => $member['email'],
        ]);

        return $this->success(null, 'Team member deactivated');
    }

    public function removeTeamMember($id)
    {
        if (!$this->canManageTeam($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $id = (int) $id;
        if ($id === $this->getPlatformUserId()) {
            return $this->error('You cannot remove yourself.', 409);
        }

        $member = $this->userModel->find($id);
        if (!$member) {
            return $this->notFound('Team member not found.');
        }

        if ($member['platform_role'] === 'Owner') {
            $ownerCount = (int) $this->userModel->where('platform_role', 'Owner')->countAllResults();
            if ($ownerCount <= 1) {
                return $this->error('Cannot remove the only Owner.', 409);
            }
        }

        $db = \Config\Database::connect();
        $db->transStart();

        AuditService::logFromRequest('platform.team.remove', 'platform_user', $id, ['email' => $member['email']]);
        $this->userModel->tombstoneAuditEntries($id);
        $this->userModel->delete($id);

        $db->transComplete();

        return $this->success(null, 'Team member removed');
    }

    public function changeTeamMemberRole($id)
    {
        if (!$this->canChangeTeamRole($this->getPlatformRole())) {
            return $this->forbidden('Only Owner can change roles.');
        }

        $member = $this->userModel->find($id);
        if (!$member) {
            return $this->notFound('Team member not found.');
        }

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['role']);
        if ($err) return $err;

        $validRoles = ['Owner', 'Admin', 'Finance', 'Support'];
        if (!in_array($body['role'], $validRoles, true)) {
            return $this->error('Invalid role.', 400);
        }

        // Block demoting last Owner
        if ($member['platform_role'] === 'Owner' && $body['role'] !== 'Owner') {
            $activeOwners = (int) $this->userModel
                ->where('platform_role', 'Owner')
                ->where('status', 'Active')
                ->countAllResults();
            if ($activeOwners <= 1) {
                return $this->error('Cannot demote the only active Owner.', 409);
            }
        }

        $this->userModel->update($id, ['platform_role' => $body['role']]);

        AuditService::logFromRequest('platform.team.change_role', 'platform_user', $id, [
            'from' => $member['platform_role'],
            'to'   => $body['role'],
        ]);

        return $this->success(null, 'Role updated');
    }

}
