<?php

namespace App\Controllers\Api;

use App\Models\OnboardingProgressModel;
use App\Models\TenantModel;
use App\Models\UserModel;
use App\Services\SchoolProvisioningService;
use RuntimeException;

/**
 * School-side onboarding endpoints. Used by the admin user during the post-
 * provisioning wizard. All endpoints require an authenticated admin whose
 * onboarding has not yet been completed.
 *
 * Routes (registered under JWTAuthFilter):
 *   GET  /api/onboarding/progress         -> getProgress()
 *   POST /api/onboarding/progress         -> saveProgress()
 *   POST /api/onboarding/complete         -> complete()
 *   POST /api/onboarding/change-password  -> changePassword()
 *
 * Feature: 043-school-creation-onboarding
 */
class OnboardingController extends BaseApiController
{
    private OnboardingProgressModel $progressModel;
    private TenantModel $tenantModel;
    private UserModel $userModel;

    public function __construct()
    {
        $this->progressModel = new OnboardingProgressModel();
        $this->tenantModel   = new TenantModel();
        $this->userModel     = new UserModel();
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/onboarding/progress
    // ──────────────────────────────────────────────────────────────
    public function getProgress()
    {
        if ($err = $this->requireAdmin()) return $err;

        $user      = $this->getCurrentUser();
        $userId    = (string) $user->id;
        $tenantId  = (string) $user->tenantId;

        $tenant = $this->tenantModel->find($tenantId);
        if (!$tenant) {
            return $this->error('Tenant not found.', 404);
        }
        $userRow = $this->userModel->find($userId);
        if (!$userRow) {
            return $this->error('User not found.', 404);
        }

        $row = $this->progressModel->getForUser($userId);

        $completed = $row && !empty($row['completed_steps'])
            ? (json_decode($row['completed_steps'], true) ?: [])
            : [];

        $current = $row['current_step'] ?? $this->progressModel->nextStep($completed) ?? 'profile';

        return $this->success([
            'current_step'        => $current,
            'completed_steps'     => $completed,
            'school_name'         => $tenant['name'] ?? '',
            'admin_email'         => $userRow['email'] ?? '',
            'is_temp_password'    => (int) ($userRow['is_temp_password'] ?? 0) === 1,
            'onboarding_complete' => (int) ($userRow['onboarding_complete'] ?? 0) === 1,
            'step_data'           => $this->progressModel->getStepData($userId),
        ]);
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/onboarding/progress
    // ──────────────────────────────────────────────────────────────
    public function saveProgress()
    {
        if ($err = $this->requireAdmin()) return $err;

        $user     = $this->getCurrentUser();
        $userId   = (string) $user->id;
        $tenantId = (string) $user->tenantId;

        $body = $this->getRequestBody();
        if ($err = $this->requireFields($body, ['step', 'data'])) return $err;

        $step = (string) $body['step'];
        $data = is_array($body['data']) ? $body['data'] : [];

        if (!in_array($step, OnboardingProgressModel::STEPS, true)) {
            return $this->error('Unknown onboarding step: ' . $step, 422);
        }

        $errors = $this->validateStepData($step, $data);
        if (!empty($errors)) {
            return $this->error('Validation failed.', 422, $errors);
        }

        // Persist step-specific data into the appropriate tenant fields. The
        // onboarding_progress.step_data column also keeps a copy for resume UX.
        $this->persistStepToTenant($tenantId, $userId, $step, $data);

        // Update completed_steps list
        $row       = $this->progressModel->getForUser($userId);
        $completed = $row && !empty($row['completed_steps'])
            ? (json_decode($row['completed_steps'], true) ?: [])
            : [];

        if (!in_array($step, $completed, true)) {
            $completed[] = $step;
        }

        $next = $this->progressModel->nextStep($completed) ?? $step;

        $this->progressModel->upsertProgress($userId, $tenantId, $next, $completed, $data, $step);

        return $this->success([
            'current_step'    => $next,
            'completed_steps' => $completed,
        ], 'Step saved.');
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/onboarding/complete
    // ──────────────────────────────────────────────────────────────
    public function complete()
    {
        if ($err = $this->requireAdmin()) return $err;

        $user     = $this->getCurrentUser();
        $userId   = (string) $user->id;
        $tenantId = (string) $user->tenantId;

        $row       = $this->progressModel->getForUser($userId);
        $completed = $row && !empty($row['completed_steps'])
            ? (json_decode($row['completed_steps'], true) ?: [])
            : [];

        $missing = $this->progressModel->missingRequiredSteps($completed);
        if (!empty($missing)) {
            return $this->error(
                'Onboarding cannot be completed. The following steps are not yet finished.',
                422,
                ['missing_steps' => $missing]
            );
        }

        $service = new SchoolProvisioningService();
        try {
            $subscription = $service->activateTenant($tenantId, $userId);
        } catch (RuntimeException $e) {
            log_message('error', '[Onboarding] activateTenant failed for tenant ' . $tenantId
                . ', user ' . $userId . ': ' . $e->getMessage());
            $code = $e->getCode() >= 400 ? $e->getCode() : 500;
            return $this->error($e->getMessage(), $code);
        }

        return $this->success([
            'tenant_id'           => $tenantId,
            'tenant_status'       => 'trialing',
            'subscription'        => [
                'plan_name'  => $subscription['plan_name'],
                'status'     => $subscription['status'],
                'starts_at'  => $subscription['starts_at'],
                'expires_at' => $subscription['expires_at'],
            ],
            'onboarding_complete' => true,
            'show_setup_guide'     => true,
            'show_tutorial'        => true,
        ], 'Onboarding complete. Your school is now active.');
    }

    // ──────────────────────────────────────────────────────────────
    // POST /api/onboarding/change-password
    // ──────────────────────────────────────────────────────────────
    public function changePassword()
    {
        if ($err = $this->requireAdmin()) return $err;

        $user   = $this->getCurrentUser();
        $userId = (string) $user->id;

        $body = $this->getRequestBody();
        if ($err = $this->requireFields($body, ['new_password', 'confirm_password'])) return $err;

        $new     = (string) $body['new_password'];
        $confirm = (string) $body['confirm_password'];

        if (strlen($new) < 8) {
            return $this->error('Password must be at least 8 characters.', 422, [
                'new_password' => 'Minimum 8 characters required.',
            ]);
        }
        if ($new !== $confirm) {
            return $this->error('Passwords do not match.', 422, [
                'confirm_password' => 'Passwords do not match.',
            ]);
        }

        $this->userModel->update($userId, [
            'password'         => password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]),
            'is_temp_password' => 0,
        ]);

        return $this->success([
            'is_temp_password' => false,
        ], 'Password updated successfully.');
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────

    private function requireAdmin()
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->error('Authentication required.', 401);
        }
        if (($user->role ?? null) !== 'admin' && ($user->role ?? null) !== 'super_admin') {
            return $this->forbidden('Only school admins may complete onboarding.');
        }
        return null;
    }

    private function validateStepData(string $step, array $data): array
    {
        $errors = [];

        switch ($step) {
            case 'password':
                // Optional step — no required fields. Any data is ignored;
                // password changes go through changePassword() endpoint.
                break;

            case 'profile':
                $name = trim((string) ($data['admin_name'] ?? ''));
                if ($name === '' || strlen($name) < 2 || strlen($name) > 100) {
                    $errors['admin_name'] = 'Admin name must be between 2 and 100 characters.';
                }
                $phone = trim((string) ($data['phone_number'] ?? ''));
                if ($phone !== '' && !$this->isValidPhoneNumber($phone)) {
                    $errors['phone_number'] = 'Enter a valid phone number using digits, spaces, +, -, or parentheses.';
                }
                break;

            case 'contact':
                $email = trim((string) ($data['contact_email'] ?? ''));
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $errors['contact_email'] = 'A valid contact email is required.';
                }
                $address = trim((string) ($data['address'] ?? ''));
                if ($address === '' || strlen($address) < 5 || strlen($address) > 500) {
                    $errors['address'] = 'School address must be between 5 and 500 characters.';
                }
                break;

            case 'work-hours':
                foreach (['staff_work_hours', 'student_work_hours'] as $key) {
                    if (!isset($data[$key]) || !is_array($data[$key])) {
                        $errors[$key] = ucfirst(str_replace('_', ' ', $key)) . ' is required.';
                        continue;
                    }
                    $start = (string) ($data[$key]['startTime'] ?? '');
                    $end   = (string) ($data[$key]['endTime'] ?? '');
                    if (!preg_match('/^\d{2}:\d{2}$/', $start) || !preg_match('/^\d{2}:\d{2}$/', $end)) {
                        $errors[$key] = 'Times must be in HH:MM format.';
                    } elseif ($start >= $end) {
                        $errors[$key] = 'Start time must be earlier than end time.';
                    }
                }
                break;

            case 'academic-calendar':
                $terms = $data['terms'] ?? [];
                if (!is_array($terms) || empty($terms)) {
                    $errors['terms'] = 'At least one term is required.';
                    break;
                }
                foreach ($terms as $i => $term) {
                    if (empty($term['name']) || empty($term['start']) || empty($term['end'])) {
                        $errors["terms.$i"] = 'Term name, start date and end date are required.';
                        continue;
                    }
                    if ($term['start'] >= $term['end']) {
                        $errors["terms.$i"] = 'Term start date must be before end date.';
                    }
                }
                break;

        }

        return $errors;
    }

    /**
     * Mirror step data into the corresponding tenant column / users field so
     * the rest of the application sees the new configuration immediately.
     */
    private function persistStepToTenant(string $tenantId, string $userId, string $step, array $data): void
    {
        $tenant = $this->tenantModel->find($tenantId);
        if (!$tenant) return;

        $settings = !empty($tenant['settings'])
            ? (json_decode($tenant['settings'], true) ?: [])
            : [];

        switch ($step) {
            case 'profile':
                $this->userModel->update($userId, [
                    'name' => trim((string) ($data['admin_name'] ?? '')),
                ]);
                $phone = trim((string) ($data['phone_number'] ?? ''));
                if ($phone !== '') {
                    $settings['adminPhone'] = $phone;
                    $settings['contactPhone'] = $settings['contactPhone'] ?? $phone;
                    $this->tenantModel->update($tenantId, [
                        'settings' => json_encode($settings),
                    ]);
                }
                break;

            case 'contact':
                $settings['contactEmail'] = trim((string) ($data['contact_email'] ?? ''));
                $settings['address']      = trim((string) ($data['address'] ?? ''));
                $this->tenantModel->update($tenantId, [
                    'settings' => json_encode($settings),
                ]);
                break;

            case 'work-hours':
                $settings['staffWorkHours']   = $data['staff_work_hours']   ?? null;
                $settings['studentWorkHours'] = $data['student_work_hours'] ?? null;
                $this->tenantModel->update($tenantId, [
                    'settings' => json_encode($settings),
                ]);
                break;

            case 'academic-calendar':
                $this->tenantModel->update($tenantId, [
                    'academic_calendar' => json_encode(['terms' => $data['terms'] ?? []]),
                ]);
                break;

        }
    }

    private function isValidPhoneNumber(string $phone): bool
    {
        if (strlen($phone) < 7 || strlen($phone) > 30) {
            return false;
        }

        if (!preg_match('/^[0-9+()\\-\\s]+$/', $phone)) {
            return false;
        }

        return preg_match_all('/\\d/', $phone) >= 7;
    }
}
