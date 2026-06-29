<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * Tracks an admin's progress through the onboarding wizard.
 *
 * One row per admin user. The completed_steps column is a JSON array of step
 * identifiers. The step_data column is an optional JSON cache of the data
 * submitted for each step (used for resume UX).
 *
 * Feature: 043-school-creation-onboarding
 */
class OnboardingProgressModel extends Model
{
    protected $table         = 'onboarding_progress';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $allowedFields = [
        'user_id',
        'tenant_id',
        'current_step',
        'completed_steps',
        'step_data',
    ];

    /**
     * Wizard step identifiers in display order. The 'password' step is optional
     * and may be skipped; the rest are mandatory before completion is allowed.
     */
    public const STEPS = [
        'password',
        'profile',
        'contact',
        'work-hours',
        'academic-calendar',
    ];

    public const REQUIRED_STEPS = [
        'profile',
        'contact',
        'work-hours',
        'academic-calendar',
    ];

    public function getForUser(string $userId): ?array
    {
        return $this->where('user_id', $userId)->first();
    }

    /**
     * Return the next step the admin should be guided to, given the current set
     * of completed steps. Returns null when every required step is finished.
     */
    public function nextStep(array $completedSteps): ?string
    {
        foreach (self::STEPS as $step) {
            if (!in_array($step, $completedSteps, true)) {
                return $step;
            }
        }
        return null;
    }

    /**
     * Insert or update the progress row for the user. The unique constraint on
     * user_id makes this an idempotent upsert.
     */
    public function upsertProgress(
        string $userId,
        string $tenantId,
        string $currentStep,
        array $completedSteps,
        ?array $stepData = null,
        ?string $stepDataKey = null
    ): void {
        $existing = $this->getForUser($userId);

        $payload = [
            'user_id'         => $userId,
            'tenant_id'       => $tenantId,
            'current_step'    => $currentStep,
            'completed_steps' => json_encode(array_values(array_unique($completedSteps))),
        ];

        if ($stepData !== null) {
            // Merge into any pre-existing step_data so each step's payload is preserved.
            // Use $stepDataKey (the step just completed) rather than $currentStep (next step).
            $key    = $stepDataKey ?? $currentStep;
            $merged = $existing && !empty($existing['step_data'])
                ? (json_decode($existing['step_data'], true) ?: [])
                : [];
            $merged[$key]         = $stepData;
            $payload['step_data'] = json_encode($merged);
        }

        if ($existing) {
            $this->update($existing['id'], $payload);
        } else {
            $this->insert($payload);
        }
    }

    /**
     * Return the full step_data JSON decoded, keyed by step.
     */
    public function getStepData(string $userId): array
    {
        $row = $this->getForUser($userId);
        if (!$row || empty($row['step_data'])) {
            return [];
        }
        return json_decode($row['step_data'], true) ?: [];
    }

    /**
     * Check whether all required steps have been completed.
     */
    public function isComplete(array $completedSteps): bool
    {
        foreach (self::REQUIRED_STEPS as $step) {
            if (!in_array($step, $completedSteps, true)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Return the list of required steps that have NOT yet been completed.
     */
    public function missingRequiredSteps(array $completedSteps): array
    {
        $missing = [];
        foreach (self::REQUIRED_STEPS as $step) {
            if (!in_array($step, $completedSteps, true)) {
                $missing[] = $step;
            }
        }
        return $missing;
    }
}
