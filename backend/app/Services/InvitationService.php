<?php

namespace App\Services;

use App\Libraries\AuditService;
use App\Models\UserInvitationModel;
use App\Models\UserModel;
use Config\Database;

/**
 * InvitationService — handles the lifecycle of user invitations:
 * issuance, invalidation, acceptance, and resending.
 *
 * Token security:
 *   - Plain token: 64 hex chars (256 bits of entropy)
 *   - Stored: SHA-256 hash of the plain token
 *   - Expiry: 48 hours from issuance
 *   - Single-use: marked accepted on consumption
 */
class InvitationService
{
    private const TOKEN_TTL_SECONDS = 48 * 60 * 60; // 48 hours

    private UserInvitationModel $invitations;
    private UserModel           $users;
    private EmailService        $email;

    public function __construct(
        ?UserInvitationModel $invitations = null,
        ?UserModel $users = null,
        ?EmailService $email = null
    ) {
        $this->invitations = $invitations ?? new UserInvitationModel();
        $this->users       = $users       ?? new UserModel();
        $this->email       = $email       ?? new EmailService();
    }

    /**
     * Issue a new invitation: insert the invitation row and dispatch an email.
     *
     * @return string The plain token (caller should NOT persist this).
     */
    public function issue(string $tenantId, string $invitedBy, array $userRow): string
    {
        $plainToken = bin2hex(random_bytes(32));
        $tokenHash  = hash('sha256', $plainToken);
        $now        = date('Y-m-d H:i:s');
        $expiresAt  = date('Y-m-d H:i:s', time() + self::TOKEN_TTL_SECONDS);

        $invitationId = 'inv' . time() . '_' . bin2hex(random_bytes(4));

        $this->invitations->insert([
            'id'              => $invitationId,
            'tenant_id'       => $tenantId,
            'invited_user_id' => $userRow['id'],
            'email'           => $userRow['email'],
            'name'            => $userRow['name'],
            'role'            => $userRow['role'],
            'invited_by'      => $invitedBy,
            'token_hash'      => $tokenHash,
            'expires_at'      => $expiresAt,
            'created_at'      => $now,
        ]);

        $inviteLink = \App\Libraries\FrontendUrl::to('accept-invite?token=' . $plainToken);

        try {
            $this->email->sendInvitation(
                $userRow['email'],
                $userRow['name'],
                $userRow['email'],
                $inviteLink
            );
        } catch (\Throwable $e) {
            log_message('error', '[InvitationService] Email send failed for ' . $userRow['email'] . ': ' . $e->getMessage());
        }

        try {
            AuditService::log('user.invite', 'user', $userRow['id'], [
                'email' => $userRow['email'],
                'role'  => $userRow['role'],
            ], $invitedBy);
        } catch (\Throwable $e) {
            log_message('warning', '[InvitationService] Audit log failed: ' . $e->getMessage());
        }

        return $plainToken;
    }

    /**
     * Mark all active invitations for a given email + tenant as invalidated.
     */
    public function invalidatePending(string $email, string $tenantId): void
    {
        $db = Database::connect();
        $db->table('user_invitations')
            ->where('email', strtolower($email))
            ->where('tenant_id', $tenantId)
            ->where('accepted_at IS NULL', null, false)
            ->where('invalidated_at IS NULL', null, false)
            ->update(['invalidated_at' => date('Y-m-d H:i:s')]);
    }

    /**
     * Accept an invitation: set the user's password, activate the account,
     * and mark the invitation as consumed.
     *
     * Returns true on success, false when the token is invalid/expired/used.
     */
    public function accept(string $plainToken, string $password): bool
    {
        $tokenHash = hash('sha256', $plainToken);
        $record    = $this->invitations->findActiveByTokenHash($tokenHash);

        if (!$record) {
            return false;
        }

        $user = $this->users->find($record['invited_user_id']);
        if (!$user) {
            return false;
        }

        $now = date('Y-m-d H:i:s');

        // Mark the invitation as accepted
        $this->invitations->update($record['id'], [
            'accepted_at' => $now,
        ]);

        // Activate the user with the chosen password
        $this->users->update($user['id'], [
            'password' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            'status'   => 'active',
        ]);

        try {
            AuditService::log('user.invite_accepted', 'user', $user['id'], [
                'email' => $user['email'],
            ], $user['id']);
        } catch (\Throwable $e) {
            log_message('warning', '[InvitationService] Audit log failed: ' . $e->getMessage());
        }

        return true;
    }

    /**
     * Resend an invitation for an existing pending user. Invalidates the
     * previous token and issues a fresh one.
     *
     * @return string The new plain token.
     */
    public function resend(string $tenantId, string $invitedBy, array $userRow): string
    {
        $this->invalidatePending($userRow['email'], $tenantId);
        $plainToken = $this->issue($tenantId, $invitedBy, $userRow);

        try {
            AuditService::log('user.invite_resent', 'user', $userRow['id'], [
                'email' => $userRow['email'],
            ], $invitedBy);
        } catch (\Throwable $e) {
            log_message('warning', '[InvitationService] Audit log failed: ' . $e->getMessage());
        }

        return $plainToken;
    }
}
