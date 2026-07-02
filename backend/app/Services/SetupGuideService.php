<?php

namespace App\Services;

use App\Models\ClassModel;
use App\Models\FeeRuleModel;
use App\Models\SetupGuideProgressModel;
use App\Models\StaffModel;
use App\Models\StudentModel;
use InvalidArgumentException;

class SetupGuideService
{
    public const STEP_ADD_STAFF = 'add-staff';
    public const STEP_ADD_CLASSES = 'add-classes';
    public const STEP_ADD_STUDENTS = 'add-students';
    public const STEP_CONFIGURE_BILLING = 'configure-billing';

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_SKIPPED = 'skipped';

    private SetupGuideProgressModel $progressModel;

    public function __construct()
    {
        $this->progressModel = new SetupGuideProgressModel();
    }

    public function getGuide(string $tenantId): array
    {
        $row = $this->progressModel->getForTenant($tenantId);
        $storedStatuses = $this->progressModel->decodeStepStatuses($row);
        $statuses = $this->normaliseStatuses($storedStatuses, $tenantId);
        $currentStep = $this->resolveCurrentStep($statuses);
        $completedAt = $this->isComplete($statuses) ? ($row['completed_at'] ?? date('Y-m-d H:i:s')) : null;

        if (!$row || $row['current_step'] !== $currentStep || json_encode($storedStatuses) !== json_encode($statuses) || ($completedAt && empty($row['completed_at']))) {
            $this->progressModel->upsertForTenant(
                $tenantId,
                $currentStep,
                $statuses,
                $row['dismissed_at'] ?? null,
                $completedAt
            );
            $row = $this->progressModel->getForTenant($tenantId);
        }

        return $this->formatGuide($tenantId, $statuses, $currentStep, $row);
    }

    public function updateStep(string $tenantId, string $stepKey, string $status): array
    {
        if (!array_key_exists($stepKey, $this->definitions())) {
            throw new InvalidArgumentException('Unknown setup guide step.');
        }

        if (!in_array($status, [self::STATUS_COMPLETED, self::STATUS_SKIPPED], true)) {
            throw new InvalidArgumentException('Setup guide status must be completed or skipped.');
        }

        if ($status === self::STATUS_SKIPPED && $stepKey !== self::STEP_ADD_STUDENTS) {
            throw new InvalidArgumentException('Only the Add Students step can be skipped.');
        }

        $row = $this->progressModel->getForTenant($tenantId);
        $statuses = $this->normaliseStatuses($this->progressModel->decodeStepStatuses($row), $tenantId);
        $statuses[$stepKey] = $status;
        $currentStep = $this->resolveCurrentStep($statuses);
        $completedAt = $this->isComplete($statuses) ? date('Y-m-d H:i:s') : null;

        $this->progressModel->upsertForTenant(
            $tenantId,
            $currentStep,
            $statuses,
            $row['dismissed_at'] ?? null,
            $completedAt
        );

        return $this->getGuide($tenantId);
    }

    public function dismiss(string $tenantId): array
    {
        $row = $this->progressModel->getForTenant($tenantId);
        $statuses = $this->normaliseStatuses($this->progressModel->decodeStepStatuses($row), $tenantId);
        $currentStep = $this->resolveCurrentStep($statuses);
        $completedAt = $this->isComplete($statuses) ? ($row['completed_at'] ?? date('Y-m-d H:i:s')) : null;

        $this->progressModel->upsertForTenant(
            $tenantId,
            $currentStep,
            $statuses,
            date('Y-m-d H:i:s'),
            $completedAt
        );

        return $this->getGuide($tenantId);
    }

    private function normaliseStatuses(array $storedStatuses, string $tenantId): array
    {
        $statuses = [];
        foreach ($this->definitions() as $key => $definition) {
            $derivedComplete = $this->isStepDerivedComplete($tenantId, $key);
            $stored = $storedStatuses[$key] ?? self::STATUS_PENDING;

            if ($derivedComplete) {
                $statuses[$key] = self::STATUS_COMPLETED;
            } elseif ($stored === self::STATUS_SKIPPED && !empty($definition['optional'])) {
                $statuses[$key] = self::STATUS_SKIPPED;
            } elseif ($stored === self::STATUS_COMPLETED) {
                $statuses[$key] = self::STATUS_COMPLETED;
            } else {
                $statuses[$key] = self::STATUS_PENDING;
            }
        }

        $currentStep = $this->resolveCurrentStep($statuses);
        if ($currentStep !== null && $statuses[$currentStep] === self::STATUS_PENDING) {
            $statuses[$currentStep] = self::STATUS_ACTIVE;
        }

        return $statuses;
    }

    private function resolveCurrentStep(array $statuses): ?string
    {
        foreach (array_keys($this->definitions()) as $key) {
            if (!in_array($statuses[$key] ?? self::STATUS_PENDING, [self::STATUS_COMPLETED, self::STATUS_SKIPPED], true)) {
                return $key;
            }
        }

        return null;
    }

    private function isComplete(array $statuses): bool
    {
        foreach ($this->definitions() as $key => $definition) {
            $status = $statuses[$key] ?? self::STATUS_PENDING;
            if (!empty($definition['optional']) && in_array($status, [self::STATUS_COMPLETED, self::STATUS_SKIPPED], true)) {
                continue;
            }
            if ($status !== self::STATUS_COMPLETED) {
                return false;
            }
        }

        return true;
    }

    private function isStepDerivedComplete(string $tenantId, string $stepKey): bool
    {
        switch ($stepKey) {
            case self::STEP_ADD_STAFF:
                return (new StaffModel())->where('tenant_id', $tenantId)->countAllResults() > 0;
            case self::STEP_ADD_CLASSES:
                return (new ClassModel())->where('tenant_id', $tenantId)->where('archived_at IS NULL')->countAllResults() > 0;
            case self::STEP_ADD_STUDENTS:
                return (new StudentModel())->where('tenant_id', $tenantId)->countAllResults() > 0;
            case self::STEP_CONFIGURE_BILLING:
                return (new FeeRuleModel())->where('tenant_id', $tenantId)->where('is_active', 1)->countAllResults() > 0;
            default:
                return false;
        }
    }

    private function formatGuide(string $tenantId, array $statuses, ?string $currentStep, ?array $row): array
    {
        $steps = [];
        foreach ($this->definitions() as $key => $definition) {
            $steps[] = [
                'key' => $key,
                'label' => $definition['label'],
                'status' => $statuses[$key] ?? self::STATUS_PENDING,
                'optional' => (bool) $definition['optional'],
                'route' => $definition['route'],
                'description' => $definition['description'],
            ];
        }

        return [
            'current_step' => $currentStep,
            'completed' => $this->isComplete($statuses),
            'dismissed' => !empty($row['dismissed_at']),
            'steps' => $steps,
            'tenant_id' => $tenantId,
        ];
    }

    private function definitions(): array
    {
        return [
            self::STEP_ADD_STAFF => [
                'label' => 'Add Staff',
                'optional' => false,
                'route' => '/staff',
                'description' => 'Add teaching and non-teaching staff so you can assign teachers to classes and track attendance. Click "Add Staff" and fill in the employee ID, name, department, and role.',
            ],
            self::STEP_ADD_CLASSES => [
                'label' => 'Add Classes',
                'optional' => false,
                'route' => '/classes',
                'description' => 'Create your school\'s classes (e.g. Grade 1A, Form 2B) before enrolling students. Students need a class assignment for fee generation and attendance. Click "Add Class" to get started.',
            ],
            self::STEP_ADD_STUDENTS => [
                'label' => 'Add Students',
                'optional' => true,
                'route' => '/students',
                'description' => 'Enrol students individually with "Add Student" or use "Bulk Import" to upload a CSV. You can skip this step now and return later — students will need a class assignment after import.',
            ],
            self::STEP_CONFIGURE_BILLING => [
                'label' => 'Configure Fee Structure and Billing Settings',
                'optional' => false,
                'route' => '/payments?tab=fee-structure',
                'description' => 'Set up fee rules on the Fee Structure tab — define amounts, scope (school-wide or by class), and billing cycle. Also configure the academic calendar in Settings so billing periods and dashboard KPIs work correctly.',
            ],
        ];
    }
}
