<?php

namespace App\Controllers\Platform;

use App\Libraries\PlatformJWTHandler;
use App\Libraries\AuditService;
use App\Libraries\FrontendUrl;
use App\Models\PlatformUser;
use App\Models\PlatformLoginHistory;
use App\Models\TenantModel;
use App\Models\UserModel;

class AuthController extends BasePlatformController
{
    private PlatformUser $platformUserModel;
    private PlatformJWTHandler $jwtHandler;

    public function __construct()
    {
        $this->platformUserModel = new PlatformUser();
        $this->jwtHandler        = new PlatformJWTHandler();
    }

    public function login()
    {
        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['email', 'password']);
        if ($err) return $err;

        $failedLoginKey = $this->platformFailedLoginThrottleKey($body['email']);

        $user = $this->platformUserModel->findByEmail($body['email']);

        // Check account status before verifying the password so that Deactivated/Invited
        // users with a correct password cannot proceed to the 2FA step. Status rejections
        // are not brute-force attempts, so they do not consume a throttle token.
        if ($user && ($user['status'] ?? 'Active') === 'Deactivated') {
            PlatformLoginHistory::logAttempt($user['id'], $body['email'], 'failed', 'account_deactivated');
            return $this->error('This account has been deactivated.', 403);
        }
        if ($user && ($user['status'] ?? 'Active') === 'Invited') {
            PlatformLoginHistory::logAttempt($user['id'], $body['email'], 'failed', 'account_pending_invite');
            return $this->error('Please accept your invitation before signing in.', 403);
        }

        if (!$user || empty($user['password_hash']) || !password_verify($body['password'], $user['password_hash'])) {
            if (!$this->consumePlatformFailedLoginAttempt($failedLoginKey)) {
                return $this->error('Too many login attempts. Please wait a minute.', 429);
            }
            PlatformLoginHistory::logAttempt($user['id'] ?? null, $body['email'], 'failed', 'invalid_password');
            return $this->error('Invalid email or password.', 401);
        }

        // Successful authentication – clear any accumulated failed-login throttle tokens for this email+IP
        service('cache')->delete($failedLoginKey);

        $this->platformUserModel->updateLastLogin($user['id']);
        PlatformLoginHistory::logAttempt($user['id'], $body['email'], 'success');

        $tokenData = [
            'id'            => $user['id'],
            'name'          => $user['name'],
            'email'         => $user['email'],
            'platform_role' => $user['platform_role'],
        ];

        $token = $this->jwtHandler->generateToken($tokenData);

        AuditService::log('platform.login', 'platform_user', $user['id'], null, $user['id']);

        return $this->success([
            'token' => $token,
            'user'  => $tokenData,
        ], 'Login successful');
    }

    private function consumeImpersonationFailedAttempt(string $userId): bool
    {
        return service('throttler')->check('platform_impersonate_failed_' . $userId, 10, MINUTE);
    }

    private function platformFailedLoginThrottleKey(string $email): string
    {
        $ip = $this->request->getIPAddress();
        return 'platform_login_failed_' . md5(strtolower(trim($email)) . '|' . $ip);
    }

    private function consumePlatformFailedLoginAttempt(string $key): bool
    {
        return service('throttler')->check($key, 10, MINUTE);
    }

    public function refresh()
    {
        // With short-lived JWTs the client re-authenticates; a refresh endpoint
        // is here as a placeholder for a future refresh-token implementation.
        return $this->error('Refresh tokens not yet implemented. Please log in again.', 501);
    }

    public function me()
    {
        $platformUser = $this->getPlatformUser();
        if (!$platformUser) {
            return $this->error('Unauthenticated.', 401);
        }

        $user = $this->platformUserModel->find($platformUser->id);
        if (!$user) {
            return $this->error('User not found.', 404);
        }

        unset($user['password_hash']);
        return $this->success($user);
    }

    public function impersonate()
    {
        $platformUser = $this->getPlatformUser();
        if (!$platformUser) {
            return $this->error('Unauthenticated.', 401);
        }
        if (!$this->canImpersonate($platformUser->platform_role)) {
            return $this->forbidden('You do not have permission to impersonate tenants.');
        }

        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['tenant_id']);
        if ($err) return $err;

        $tenantModel = new TenantModel();
        $tenant      = $tenantModel->find($body['tenant_id']);
        if (!$tenant) {
            // Consume a throttle token only on failed lookups to guard against
            // tenant ID enumeration. Successful impersonations do not consume tokens.
            if (!$this->consumeImpersonationFailedAttempt($platformUser->id)) {
                return $this->error('Too many impersonation attempts. Please wait a minute.', 429);
            }
            return $this->notFound('Tenant not found.');
        }

        // Find a tenant admin user — prefer super_admin, fall back to admin.
        // (Many tenants only have 'admin' role users provisioned.)
        $userModel   = new UserModel();
        $tenantAdmin = $userModel
            ->where('tenant_id', $body['tenant_id'])
            ->whereIn('role', ['super_admin', 'admin'])
            ->orderBy("FIELD(role, 'super_admin', 'admin')", '', false)
            ->first();

        if (!$tenantAdmin) {
            return $this->notFound('No admin user found for this tenant. Cannot impersonate.');
        }

        $impersonationToken = $this->jwtHandler->generateImpersonationToken([
            'id'              => $tenantAdmin['id'],
            'tenantId'        => $body['tenant_id'],
            'email'           => $tenantAdmin['email'],
            'name'            => $tenantAdmin['name'] ?? null,
            'role'            => $tenantAdmin['role'],
            'impersonator_id' => $platformUser->id,
        ], $platformUser->id);

        AuditService::log(
            'platform.impersonate',
            'tenant',
            $body['tenant_id'],
            ['impersonated_user_id' => $tenantAdmin['id']],
            $platformUser->id
        );

        // Return the user payload alongside the token so the admin frontend can
        // hydrate the tenant app's AuthContext (school_management_auth +
        // schoolledger_tenant_id) before redirecting — otherwise the tenant
        // ProtectedRoute bounces to /login on first paint.
        return $this->success([
            'token' => $impersonationToken,
            'user'  => [
                'id'        => $tenantAdmin['id'],
                'name'      => $tenantAdmin['name']  ?? null,
                'email'     => $tenantAdmin['email'] ?? null,
                'role'      => $tenantAdmin['role'],
                'tenantId'  => $body['tenant_id'],
                'isImpersonating' => true,
            ],
        ], 'Impersonation token issued');
    }

    public function stopImpersonation()
    {
        $platformUser = $this->getPlatformUser();
        AuditService::log('platform.stop_impersonation', null, null, null, $platformUser->id ?? null);
        return $this->success(null, 'Impersonation ended');
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/platform/auth/forgot-password
    // ──────────────────────────────────────────────────────────────
    public function forgotPassword()
    {
        // Rate limit: 5 requests per IP per minute to deter abuse
        $throttler = service('throttler');
        $ip        = $this->request->getIPAddress();
        if (!$throttler->check('platform_forgot_pwd_' . md5($ip), 5, MINUTE)) {
            return $this->error('Too many requests. Please wait a minute.', 429);
        }

        $body  = $this->getRequestBody();
        $email = strtolower(trim((string) ($body['email'] ?? '')));

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error('A valid email address is required.', 400);
        }

        $user = $this->platformUserModel->findByEmail($email);

        // Always respond success — never reveal whether the account exists
        if (!$user) {
            return $this->success(null, 'If that email exists, a reset link has been sent.');
        }

        $db = \Config\Database::connect();

        // Invalidate any existing unused platform tokens for this email
        $db->table('password_reset_tokens')
            ->where('email', $email)
            ->where('scope', 'platform')
            ->where('used_at IS NULL', null, false)
            ->update(['used_at' => date('Y-m-d H:i:s')]);

        // Generate a cryptographically secure token
        $plainToken = bin2hex(random_bytes(32));
        $tokenHash  = hash('sha256', $plainToken);
        $expiresAt  = date('Y-m-d H:i:s', time() + 1800); // 30 minutes

        $db->table('password_reset_tokens')->insert([
            'email'      => $email,
            'scope'      => 'platform',
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $resetLink = FrontendUrl::to('platform-control-panel/reset-password?token=' . $plainToken);

        try {
            (new \App\Services\EmailService())->sendPasswordReset(
                $email,
                $user['name'],
                $email,
                $resetLink
            );
        } catch (\Throwable $e) {
            log_message('error', '[Platform.ForgotPassword] Email send failed: ' . $e->getMessage());
        }

        AuditService::log('platform.forgot_password', 'platform_user', $user['id'], null, $user['id']);

        return $this->success(null, 'If that email exists, a reset link has been sent.');
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/platform/auth/reset-password
    // ──────────────────────────────────────────────────────────────
    public function resetPassword()
    {
        $body     = $this->getRequestBody();
        $token    = (string) ($body['token']    ?? '');
        $password = (string) ($body['password'] ?? '');

        if ($token === '' || $password === '') {
            return $this->error('Token and new password are required.', 400);
        }

        if (strlen($password) < 8) {
            return $this->error('Password must be at least 8 characters.', 400);
        }

        $tokenHash = hash('sha256', $token);
        $db        = \Config\Database::connect();

        $record = $db->table('password_reset_tokens')
            ->where('token_hash', $tokenHash)
            ->where('scope', 'platform')
            ->where('used_at IS NULL', null, false)
            ->where('expires_at >', date('Y-m-d H:i:s'))
            ->get()
            ->getRowArray();

        if (!$record) {
            return $this->error('This reset link is invalid or has expired.', 400);
        }

        $user = $this->platformUserModel->findByEmail($record['email']);
        if (!$user) {
            return $this->error('This reset link is invalid or has expired.', 400);
        }

        // Mark token as used
        $db->table('password_reset_tokens')
            ->where('token_hash', $tokenHash)
            ->where('scope', 'platform')
            ->update(['used_at' => date('Y-m-d H:i:s')]);

        // Update platform user password (column is `password_hash`)
        $this->platformUserModel->update($user['id'], [
            'password_hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
        ]);

        AuditService::log('platform.reset_password', 'platform_user', $user['id'], null, $user['id']);

        return $this->success(null, 'Your password has been reset. You can now sign in.');
    }

    public function loginHistory()
    {
        $userId = $this->getPlatformUserId();
        if (!$userId) return $this->error('Unauthenticated.', 401);

        $rows = (new PlatformLoginHistory())->forUser($userId, 20);
        return $this->success($rows);
    }

    // ─── Accept invitation (PUBLIC) ───────────────────────────────────────────

    public function acceptInvite()
    {
        $body = $this->getRequestBody();
        $err  = $this->requireFields($body, ['token', 'password', 'password_confirmation']);
        if ($err) return $err;

        if ($body['password'] !== $body['password_confirmation']) {
            return $this->error('Passwords do not match.', 400);
        }
        if (strlen($body['password']) < 8) {
            return $this->error('Password must be at least 8 characters.', 400);
        }

        $tokenHash = hash('sha256', $body['token']);
        $db        = \Config\Database::connect();

        $invite = $db->table('platform_invitations')
            ->where('token_hash', $tokenHash)
            ->where('accepted_at IS NULL', null, false)
            ->where('expires_at >', date('Y-m-d H:i:s'))
            ->get()->getRowArray();

        if (!$invite) {
            return $this->error('This invitation link is invalid or has expired.', 400);
        }

        $userId = (int) $invite['platform_user_id'];
        $user   = $this->platformUserModel->find($userId);
        if (!$user) {
            return $this->error('This invitation is no longer valid.', 400);
        }

        $db->transStart();

        $this->platformUserModel->update($userId, [
            'password_hash' => password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]),
            'status'        => 'Active',
        ]);

        $db->table('platform_invitations')
            ->where('id', $invite['id'])
            ->update(['accepted_at' => date('Y-m-d H:i:s')]);

        $db->transComplete();

        AuditService::log('platform.team.invite_accepted', 'platform_user', $userId, null, $userId, $user['name'], $user['email']);

        return $this->success(null, 'Account activated. You can now sign in.');
    }

}
