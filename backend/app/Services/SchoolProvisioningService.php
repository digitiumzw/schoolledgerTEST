<?php

namespace App\Services;

use App\Libraries\AuditService;
use App\Models\OnboardingProgressModel;
use App\Models\SchoolSubscriptionModel;
use App\Models\TenantModel;
use App\Models\UserModel;
use Config\Database;
use RuntimeException;

/**
 * Provisions a new school: creates the tenant, the admin user, and dispatches
 * the welcome email. Also handles activation (tenant status transition + free
 * trial subscription enrollment) at onboarding completion, and resending the
 * welcome email when the platform user requests it.
 *
 * Feature: 043-school-creation-onboarding
 */
class SchoolProvisioningService
{
    private const TRIAL_MONTHS = 1;

    private TenantModel $tenantModel;
    private UserModel $userModel;
    private SchoolSubscriptionModel $subscriptionModel;
    private OnboardingProgressModel $progressModel;
    private EmailService $emailService;

    public function __construct(
        ?TenantModel $tenantModel = null,
        ?UserModel $userModel = null,
        ?SchoolSubscriptionModel $subscriptionModel = null,
        ?OnboardingProgressModel $progressModel = null,
        ?EmailService $emailService = null
    ) {
        $this->tenantModel       = $tenantModel       ?? new TenantModel();
        $this->userModel         = $userModel         ?? new UserModel();
        $this->subscriptionModel = $subscriptionModel ?? new SchoolSubscriptionModel();
        $this->progressModel     = $progressModel     ?? new OnboardingProgressModel();
        $this->emailService      = $emailService      ?? new EmailService();
    }

    /**
     * Provision a new school: create the tenant + admin user, send the welcome
     * email, and return a summary array. The school is created in 'pending'
     * status — it transitions to 'trialing' only when activateTenant() runs at
     * the end of the onboarding wizard.
     *
     * @return array{tenant: array, user_id: string, temp_password: string, email_sent: bool}
     *
     * @throws RuntimeException with code 409 if a user with the email already exists
     * @throws RuntimeException with code 422 if validation fails
     */
    public function provision(string $name, string $email): array
    {
        $name  = trim($name);
        $email = strtolower(trim($email));

        if ($name === '') {
            throw new RuntimeException('School name is required.', 422);
        }
        if (strlen($name) > 255) {
            throw new RuntimeException('School name must be 255 characters or fewer.', 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid admin email address is required.', 422);
        }

        // Race-safe duplicate detection — defended again at DB level by the
        // UNIQUE index on users.email.
        if ($this->userModel->findByEmail($email) !== null) {
            throw new RuntimeException('An admin account with this email address already exists.', 409);
        }

        $tempPassword = $this->generateTemporaryPassword();
        $tenantId     = $this->generateUuid();
        $userId       = 'u' . time() . '_' . bin2hex(random_bytes(4));
        $subdomain    = $this->generateUniqueSubdomain($name);

        $db = Database::connect();
        $db->transStart();

        try {
            $this->tenantModel->insert([
                'id'        => $tenantId,
                'name'      => $name,
                'email'     => $email,
                'subdomain' => $subdomain,
                'status'    => 'pending',
                'settings'  => json_encode(['schoolName' => $name]),
            ]);

            $this->userModel->insert([
                'id'                   => $userId,
                'tenant_id'            => $tenantId,
                'role'                 => 'super_admin',
                'email'                => $email,
                'password'             => password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 12]),
                'name'                 => '',
                'status'               => 'active',
                'is_temp_password'     => 1,
                'onboarding_complete'  => 0,
            ]);

            $db->transComplete();

            if ($db->transStatus() === false) {
                throw new RuntimeException('Failed to provision school. Please try again.', 500);
            }
        } catch (\Throwable $e) {
            $db->transRollback();
            // Surface duplicate-key as a 409 even when caught at DB level
            if (str_contains($e->getMessage(), 'Duplicate') || str_contains($e->getMessage(), '1062')) {
                throw new RuntimeException('An admin account with this email address already exists.', 409);
            }
            throw $e;
        }

        // Send the welcome email outside the transaction. Failure should NOT
        // roll back the school record — the platform user can resend.
        $emailSent = false;
        try {
            $this->emailService->sendWelcome(
                $email,                 // to
                $email,                 // recipient_name (admin has no name yet)
                $email,                 // recipient_email
                $name,                  // school_name
                $tempPassword           // temp_password
            );
            $emailSent = true;
        } catch (\Throwable $e) {
            log_message('error', '[SchoolProvisioning] Welcome email failed for tenant '
                . $tenantId . ': ' . $e->getMessage());
        }

        // Audit log — actor identity is added by AuditService from the request
        try {
            AuditService::logFromRequest('platform.tenant.provision', 'tenant', $tenantId, [
                'name'       => $name,
                'email'      => $email,
                'subdomain'  => $subdomain,
                'email_sent' => $emailSent,
            ]);
        } catch (\Throwable $e) {
            // Audit failures must never break provisioning
            log_message('warning', '[SchoolProvisioning] Audit log failed: ' . $e->getMessage());
        }

        return [
            'tenant'        => $this->tenantModel->find($tenantId),
            'user_id'       => $userId,
            'temp_password' => $tempPassword,
            'email_sent'    => $emailSent,
        ];
    }

    /**
     * Resend the welcome email for a tenant that is still in 'pending' status.
     * Generates a new temporary password (the previous one is invalidated since
     * the user has not yet logged in — they cannot have already used it).
     *
     * @throws RuntimeException with code 404 if the tenant or user is missing
     * @throws RuntimeException with code 409 if the tenant is already activated
     */
    public function resendWelcome(string $tenantId): void
    {
        $tenant = $this->tenantModel->find($tenantId);
        if (!$tenant) {
            throw new RuntimeException('Tenant not found.', 404);
        }
        if (($tenant['status'] ?? null) !== 'pending') {
            throw new RuntimeException(
                'This school has already completed onboarding. Resend is only available for pending schools.',
                409
            );
        }

        $user = $this->userModel
            ->where('tenant_id', $tenantId)
            ->whereIn('role', ['super_admin', 'admin'])
            ->orderBy('created_at', 'ASC')
            ->first();

        if (!$user) {
            throw new RuntimeException('No admin account is associated with this tenant.', 404);
        }

        $newTempPassword = $this->generateTemporaryPassword();
        $this->userModel->update($user['id'], [
            'password'         => password_hash($newTempPassword, PASSWORD_BCRYPT, ['cost' => 12]),
            'is_temp_password' => 1,
        ]);

        $this->emailService->sendWelcome(
            $user['email'],
            $user['name'] ?: $user['email'],
            $user['email'],
            $tenant['name'] ?? 'Your School',
            $newTempPassword
        );

        try {
            AuditService::logFromRequest('platform.tenant.resend_welcome', 'tenant', $tenantId, [
                'email' => $user['email'],
            ]);
        } catch (\Throwable $e) {
            log_message('warning', '[SchoolProvisioning] Audit log failed: ' . $e->getMessage());
        }
    }

    /**
     * Activate the tenant at onboarding completion: mark the user complete,
     * transition the tenant to 'trialing', and enroll the 3-month unlimited
     * free trial subscription. All operations are wrapped in a transaction so
     * a partial activation cannot occur.
     *
     * @return array Subscription details (plan_name, status, starts_at, expires_at)
     *
     * @throws RuntimeException 500 if no unlimited trial plan is configured
     */
    public function activateTenant(string $tenantId, string $userId): array
    {
        $db = Database::connect();

        // Identify the unlimited (NULL max_students) active plan
        $plan = $db->table('subscription_plans')
            ->where('max_students', null)
            ->where('is_active', 1)
            ->orderBy('sort_order', 'ASC')
            ->get(1)
            ->getRowArray();

        if (!$plan) {
            throw new RuntimeException(
                'Unable to enroll trial subscription: no unlimited plan is configured. Please contact support.',
                500
            );
        }

        // Set activeAcademicSession from the server system year.
        $tenant = $db->table('tenants')->where('id', $tenantId)->get()->getRowArray();

        $existingSettings = [];
        if (!empty($tenant['settings'])) {
            $decoded = json_decode($tenant['settings'], true);
            if (is_array($decoded)) {
                $existingSettings = $decoded;
            }
        }

        $sessionYear = (int) date('Y');
        $existingSettings['activeAcademicSession'] = $sessionYear . '/' . ($sessionYear + 1);

        $now        = date('Y-m-d H:i:s');
        $expiresAt  = date('Y-m-d H:i:s', strtotime('+' . self::TRIAL_MONTHS . ' months'));
        $subId      = $this->generateUuid();

        $db->transStart();

        // Cancel any prior pending subscriptions defensively
        $this->subscriptionModel->cancelPendingForTenant($tenantId);

        $this->subscriptionModel->insert([
            'id'                => $subId,
            'tenant_id'         => $tenantId,
            'plan_id'           => $plan['id'],
            'billing_cycle'     => 'monthly',
            'status'            => 'active',
            'starts_at'         => $now,
            'expires_at'        => $expiresAt,
            'amount_paid_cents' => 0,
            'currency'          => $plan['currency'] ?? 'USD',
            'activated_at'      => $now,
        ]);

        $this->tenantModel->update($tenantId, [
            'status'   => 'trialing',
            'settings' => json_encode($existingSettings),
        ]);
        $this->userModel->update($userId, ['onboarding_complete' => 1]);

        $db->transComplete();

        if ($db->transStatus() === false) {
            throw new RuntimeException('Activation failed. Please try again.', 500);
        }

        try {
            AuditService::logFromRequest('tenant.onboarding.complete', 'tenant', $tenantId, [
                'plan_id'    => $plan['id'],
                'expires_at' => $expiresAt,
            ]);
        } catch (\Throwable $e) {
            log_message('warning', '[SchoolProvisioning] Audit log failed: ' . $e->getMessage());
        }

        return [
            'plan_id'    => $plan['id'],
            'plan_name'  => $plan['name'] ?? 'Unlimited',
            'status'     => 'active',
            'starts_at'  => $now,
            'expires_at' => $expiresAt,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────

    private function generateTemporaryPassword(): string
    {
        // Fixed default temporary password for new school registrations
        return 'schoolledger';
    }

    private function generateUuid(): string
    {
        $data    = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    private function generateUniqueSubdomain(string $name): string
    {
        $base = strtolower(preg_replace('/[^a-z0-9]+/', '-', strtolower($name)));
        $base = trim($base, '-');
        if ($base === '') {
            $base = 'school';
        }
        $base = substr($base, 0, 60);

        $candidate = $base;
        $suffix    = 1;
        while ($this->tenantModel->where('subdomain', $candidate)->first() !== null) {
            $suffix++;
            $candidate = substr($base, 0, 56) . '-' . $suffix;
        }
        return $candidate;
    }
}
