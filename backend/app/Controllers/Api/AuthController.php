<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Models\PlatformSetting;
use App\Libraries\JWTHandler;
use App\Services\EmailService;
use App\Services\InvitationService;

class AuthController extends BaseApiController
{
    protected UserModel $userModel;
    protected JWTHandler $jwtHandler;

    // Brute-force guard: max failed attempts before lockout
    private const MAX_ATTEMPTS   = 10;
    private const LOCKOUT_WINDOW = 300; // seconds (5 minutes)

    public function __construct()
    {
        $this->userModel  = new UserModel();
        $this->jwtHandler = new JWTHandler();
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/auth/login
    // ──────────────────────────────────────────────────────────────
    public function login()
    {
        $data     = $this->getRequestBody();
        $email    = strtolower($this->sanitiseString($data['email'] ?? ''));
        $password = $data['password'] ?? '';

        if ($email === '' || $password === '') {
            return $this->error('Email and password are required', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error('Invalid email format', 400);
        }

        // Brute-force protection
        $cacheKey = 'login_attempts_' . md5($email . $this->request->getIPAddress());
        $cache    = \Config\Services::cache();
        $attempts = (int) ($cache->get($cacheKey) ?? 0);

        if ($attempts >= self::MAX_ATTEMPTS) {
            return $this->error('Too many failed login attempts. Please try again in 5 minutes.', 429);
        }

        // Pending (invited) accounts cannot log in until they accept their invite
        // and set a password. We surface a clear, fixable message rather than the
        // generic "invalid credentials" error.
        $existing = $this->userModel->findByEmail($email);
        if ($existing && ($existing['status'] ?? 'active') === 'invited') {
            return $this->error(
                'Your account is pending. Please accept your invitation email to set a password.',
                403
            );
        }

        $user = $this->userModel->authenticate($email, $password);

        if (!$user) {
            $cache->save($cacheKey, $attempts + 1, self::LOCKOUT_WINDOW);
            // Generic message — do not reveal whether the email exists
            return $this->error('Invalid email or password', 401);
        }

        // Clear failed attempts on successful authentication
        $cache->delete($cacheKey);

        if (($user['status'] ?? 'active') === 'inactive') {
            return $this->error('Your account has been deactivated. Please contact an administrator.', 403);
        }

        // ── Maintenance mode check ────────────────────────────────────
        // Block non-super_admin logins when maintenance mode is active.
        // super_admin bypasses so they can still access the platform.
        $settingModel    = new PlatformSetting();
        $maintenanceMode = (bool) $settingModel->get('maintenance_mode');

        if ($maintenanceMode && ($user['role'] ?? '') !== 'super_admin') {
            $headline = (string) $settingModel->get('maintenance_headline');
            $message  = (string) $settingModel->get('maintenance_message');
            if ($headline === '') {
                $headline = 'Platform Under Maintenance';
            }
            if ($message === '') {
                $message = 'The platform is currently under maintenance. Service will be restored shortly.';
            }

            log_message('info', '[AuthController] Maintenance mode active — blocking login for non-super_admin (email: ' . $email . ')');

            return $this->setCorsHeaders(
                $this->respond([
                    'status'  => false,
                    'message' => $headline,
                    'data'    => [
                        'maintenance_mode' => true,
                        'headline'         => $headline,
                        'message'          => $message,
                    ],
                ], 503)
            );
        }

        // Check if the tenant account is suspended or still pending onboarding
        $db     = \Config\Database::connect();
        $tenant = $db->table('tenants')->select('status')->where('id', $user['tenant_id'])->get()->getRowArray();
        if ($tenant && ($tenant['status'] ?? 'active') === 'suspended') {
            return $this->error('Your account is currently suspended. Access is restricted. Please contact support for assistance.', 403);
        }

        // Pending tenants are allowed to log in only so the admin can complete
        // onboarding. The frontend route guard will redirect them to /onboarding.
        // No special handling needed here — the onboarding_complete flag below
        // governs frontend routing.

        // Invalidate the temporary password on first successful login. The admin
        // may still optionally change it during the onboarding wizard, but the
        // act of logging in alone is sufficient to mark it as no longer temporary.
        if ((int) ($user['is_temp_password'] ?? 0) === 1) {
            $this->userModel->update($user['id'], ['is_temp_password' => 0]);
            $user['is_temp_password'] = 0;
        }

        $tokenPayload = [
            'id'                  => $user['id'],
            'tenantId'            => $user['tenant_id'],
            'email'               => $user['email'],
            'name'                => $user['name'],
            'role'                => $user['role'],
            'onboardingComplete'  => (int) ($user['onboarding_complete'] ?? 1) === 1,
        ];

        $token = $this->jwtHandler->generateToken($tokenPayload);

        return $this->success([
            'user'  => $this->formatUser($user),
            'token' => $token,
        ], 'Login successful');
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/auth/refresh
    // ──────────────────────────────────────────────────────────────
    public function refresh()
    {
        $currentUser = $this->getCurrentUser();

        if (!$currentUser) {
            return $this->error('Authentication required', 401);
        }

        // Fetch the live user record — role or status may have changed since last login
        $user = $this->userModel->find($currentUser->id);
        if (!$user || ($user['status'] ?? 'active') === 'inactive') {
            return $this->error('Account is inactive', 403);
        }

        $tokenPayload = [
            'id'       => $user['id'],
            'tenantId' => $user['tenant_id'],
            'email'    => $user['email'],
            'name'     => $user['name'],
            'role'     => $user['role'],
        ];

        $token = $this->jwtHandler->generateToken($tokenPayload);

        return $this->success([
            'user'  => $this->formatUser($user),
            'token' => $token,
        ], 'Token refreshed');
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/auth/register  (admin-only in production)
    // ──────────────────────────────────────────────────────────────
    public function register()
    {
        $data = $this->getRequestBody();

        // Validate required fields
        if ($err = $this->requireFields($data, ['email', 'password', 'name', 'tenantId'])) {
            return $err;
        }

        $email = strtolower($this->sanitiseString($data['email']));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error('Invalid email format', 400);
        }

        $password = $data['password'];
        if (strlen($password) < 8) {
            return $this->error('Password must be at least 8 characters', 400);
        }

        $role = $data['role'] ?? 'admin';
        if (!in_array($role, self::VALID_ROLES, true)) {
            return $this->error('Invalid role. Must be one of: ' . implode(', ', self::VALID_ROLES), 400);
        }

        // Prevent duplicate emails within the same tenant
        $existing = $this->userModel
            ->where('email', $email)
            ->where('tenant_id', $data['tenantId'])
            ->first();

        if ($existing) {
            return $this->error('An account with this email already exists', 409);
        }

        $userId   = $this->generateId('u');
        $userData = [
            'id'        => $userId,
            'tenant_id' => $data['tenantId'],
            'email'     => $email,
            'password'  => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            'name'      => $this->sanitiseString($data['name']),
            'role'      => $role,
            'status'    => 'active',
        ];

        $this->userModel->insert($userData);

        return $this->created($this->formatUser($userData), 'User registered successfully');
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/auth/me
    // ──────────────────────────────────────────────────────────────
    public function me()
    {
        $currentUser = $this->getCurrentUser();

        if (!$currentUser) {
            return $this->error('Not authenticated', 401);
        }

        // Return live data so UI always reflects current role/status
        $user = $this->userModel->find($currentUser->id);
        if (!$user) {
            return $this->error('User account not found', 404);
        }

        return $this->success($this->formatUser($user));
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/auth/forgot-password
    // ──────────────────────────────────────────────────────────────
    public function forgotPassword()
    {
        $data  = $this->getRequestBody();
        $email = strtolower($this->sanitiseString($data['email'] ?? ''));

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->error('A valid email address is required', 400);
        }

        $user = $this->userModel->where('email', $email)->first();

        // Always return success — do not reveal whether the email exists
        if (!$user) {
            return $this->success(null, 'If that email exists, a reset link has been sent.');
        }

        $db = \Config\Database::connect();

        // Invalidate any existing unused tenant tokens for this email
        $db->table('password_reset_tokens')
            ->where('email', $email)
            ->where('scope', 'tenant')
            ->where('used_at IS NULL', null, false)
            ->update(['used_at' => date('Y-m-d H:i:s')]);

        // Generate a cryptographically secure token
        $plainToken = bin2hex(random_bytes(32));
        $tokenHash  = hash('sha256', $plainToken);
        $expiresAt  = date('Y-m-d H:i:s', time() + 1800); // 30 minutes

        $db->table('password_reset_tokens')->insert([
            'email'      => $email,
            'scope'      => 'tenant',
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $resetLink = \App\Libraries\FrontendUrl::to('reset-password?token=' . $plainToken);

        try {
            (new EmailService())->sendPasswordReset(
                $email,
                $user['name'],
                $email,
                $resetLink
            );
        } catch (\Throwable $e) {
            log_message('error', '[ForgotPassword] Email send failed: ' . $e->getMessage());
        }

        return $this->success(null, 'If that email exists, a reset link has been sent.');
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/auth/reset-password
    // ──────────────────────────────────────────────────────────────
    public function resetPassword()
    {
        $data     = $this->getRequestBody();
        $token    = $data['token']    ?? '';
        $password = $data['password'] ?? '';

        if ($token === '' || $password === '') {
            return $this->error('Token and new password are required', 400);
        }

        if (strlen($password) < 8) {
            return $this->error('Password must be at least 8 characters', 400);
        }

        $tokenHash = hash('sha256', $token);
        $db        = \Config\Database::connect();

        $record = $db->table('password_reset_tokens')
            ->where('token_hash', $tokenHash)
            ->where('scope', 'tenant')
            ->where('used_at IS NULL', null, false)
            ->where('expires_at >', date('Y-m-d H:i:s'))
            ->get()
            ->getRowArray();

        if (!$record) {
            return $this->error('This reset link is invalid or has expired.', 400);
        }

        // Mark token as used
        $db->table('password_reset_tokens')
            ->where('token_hash', $tokenHash)
            ->where('scope', 'tenant')
            ->update(['used_at' => date('Y-m-d H:i:s')]);

        // Update password
        $this->userModel
            ->where('email', $record['email'])
            ->set(['password' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12])])
            ->update();

        return $this->success(null, 'Your password has been reset. You can now sign in.');
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/auth/accept-invite (public)
    // ──────────────────────────────────────────────────────────────
    public function acceptInvite()
    {
        $data     = $this->getRequestBody();
        $token    = (string) ($data['token']    ?? '');
        $password = (string) ($data['password'] ?? '');

        if ($token === '' || $password === '') {
            return $this->error('Token and password are required', 400);
        }

        if (strlen($password) < 8) {
            return $this->error('Password must be at least 8 characters', 400);
        }

        $accepted = (new InvitationService())->accept($token, $password);

        if (!$accepted) {
            return $this->error('This invitation link is invalid or has expired.', 400);
        }

        return $this->success(null, 'Your account is ready. You can now sign in.');
    }

    // ──────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────

    private function formatUser(array $user): array
    {
        return [
            'id'                  => $user['id'],
            'tenantId'            => $user['tenant_id'],
            'email'               => $user['email'],
            'name'                => $user['name'],
            'role'                => $user['role'],
            'status'              => $user['status'] ?? 'active',
            'isTempPassword'      => (int) ($user['is_temp_password'] ?? 0) === 1,
            'onboardingComplete'  => (int) ($user['onboarding_complete'] ?? 1) === 1,
        ];
    }
}
