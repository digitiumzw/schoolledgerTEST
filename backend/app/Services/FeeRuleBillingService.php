<?php

namespace App\Services;

use App\Models\FeeRuleModel;
use App\Services\ChargeProrationHelper;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\Database\Config;
use InvalidArgumentException;

/**
 * FeeRuleBillingService — the engine that drives fee rule based charge
 * generation, the unbilled-student alert, and billing meta lookup.
 *
 * Feature: 056-fee-structure-billing
 *
 * Responsibilities (research.md §D3):
 *  - Resolve the school's billing cycle from `tenants.fee_structure.structureType`.
 *  - For each active fee rule, find eligible students based on its scope.
 *  - Insert charges transactionally; rely on the UNIQUE
 *    (student_id, fee_rule_id, billing_period) constraint to skip duplicates.
 *  - Report counts of generated vs. skipped per rule.
 *  - Compute the "current billing period" used by the unbilled alert.
 */
class FeeRuleBillingService
{
    private const VALID_SCOPE_TYPES = ['school_wide', 'class', 'category', 'service', 'student'];

    private BaseConnection $db;
    private FeeRuleModel   $rules;
    private AcademicCalendarService $calendar;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db       = $db ?? Config::connect();
        $this->rules    = new FeeRuleModel();
        $this->calendar = new AcademicCalendarService();
    }

    // ──────────────────────────────────────────────────────────────
    // Billing meta
    // ──────────────────────────────────────────────────────────────

    /**
     * Return billing cycle metadata used by the charge-generation UI.
     *
     * Output shape:
     *   structureType    'monthly' | 'termly'
     *   currentPeriod    'YYYY-MM' or term_id
     *   availablePeriods [{ value, label }]   (current ± a few siblings)
     */
    public function getBillingMeta(string $tenantId): array
    {
        $tenant   = $this->loadTenant($tenantId);
        $cycle    = $this->resolveStructureType($tenant);
        $calendar = $this->decodeJson($tenant['academic_calendar'] ?? null);

        if ($cycle === 'monthly') {
            $current = date('Y-m');
            $periods = $this->buildMonthlyOptions($current);
        } else {
            $term    = $this->calendar->getCurrentTerm($calendar, date('Y-m-d'));
            $current = $term['id'] ?? '';
            $periods = $this->buildTermlyOptions($calendar);
        }

        return [
            'structureType'    => $cycle,
            'currentPeriod'    => $current,
            'availablePeriods' => $periods,
        ];
    }

    // ──────────────────────────────────────────────────────────────
    // Charge generation
    // ──────────────────────────────────────────────────────────────

    /**
     * Generate charges for a given billing period.
     *
     * @param string      $tenantId
     * @param string      $billingPeriod  'YYYY-MM' (monthly) or term_id (termly).
     * @param array|null  $feeRuleIds     Optional subset of rule IDs; default = all active.
     * @param string|null $createdBy      Authenticated user ID (for audit).
     * @return array generation result (see contracts/charge-generation.md)
     *
     * @throws InvalidArgumentException for validation failures (caller maps to 422).
     */
    public function generateCharges(
        string  $tenantId,
        string  $billingPeriod,
        ?array  $feeRuleIds = null,
        ?string $createdBy  = null
    ): array {
        $tenant = $this->loadTenant($tenantId);
        $cycle  = $this->resolveStructureType($tenant);

        $this->validateBillingPeriod($billingPeriod, $cycle, $tenant);

        $rules = $this->rules->getActiveByTenant($tenantId);
        if (!empty($feeRuleIds)) {
            $rules = array_values(array_filter(
                $rules,
                fn($r) => in_array($r['id'], $feeRuleIds, true)
            ));
        }

        if (empty($rules)) {
            return $this->emptyResult($billingPeriod);
        }

        $calendarData    = $this->decodeJson($tenant['academic_calendar'] ?? null);
        $term            = ($cycle === 'termly')
            ? $this->findTerm($calendarData, $billingPeriod)
            : null;
        $batchService    = new ChargeBatchRollbackService($this->db);
        $labels          = $batchService->buildFeeRuleLabels($billingPeriod, $calendarData);
        $billingRunId    = null;
        $generatedCount = 0;
        $skippedCount   = 0;
        $totalAmount    = 0.0;
        $perRule        = [];
        $chargedStudents = [];
        $now            = date('Y-m-d H:i:s');
        $today          = date('Y-m-d');

        $settings          = $this->decodeJson($tenant['settings'] ?? null);
        $prorationEnabled  = (bool) ($settings['chargeProrationEnabled'] ?? false);
        $periodStart       = $this->resolvePeriodStart($billingPeriod, $cycle, $term);
        $periodEnd         = $this->resolvePeriodEnd($billingPeriod, $cycle, $term);

        // Pre-fetch existing (student_id, fee_rule_id) tuples for this period
        // so we can skip duplicates in PHP. We deliberately avoid relying on
        // try/catch around the UNIQUE-constraint violation: in CodeIgniter 4,
        // a failed query inside transStart() flips transStatus() to false and
        // rolls back the entire batch at transComplete(), even when the
        // exception is caught.
        $ruleIds      = array_column($rules, 'id');
        $existingKeys = $this->fetchExistingChargeKeys($tenantId, $ruleIds, $billingPeriod);

        $this->db->transStart();

        try {

        $billingRunId = $batchService->createBillingRun(
            $tenantId,
            ChargeBatchRollbackService::FEE_RULE_CHARGE_TYPE,
            $labels['periodKey'],
            $labels['periodLabel'],
            $labels['descriptionLabel'],
            $labels['termId'] ?? ($term['id'] ?? null),
            $labels['academicYear'] ?? ($tenant['academic_session'] ?? null),
            $createdBy,
            'frun_'
        );

        $pendingCharges = [];

        foreach ($rules as $rule) {
            $eligible      = $this->getEligibleStudents($tenantId, $rule);
            $ruleGenerated = 0;
            $ruleAmount    = 0.0;

            foreach ($eligible as $student) {
                $key = $student['id'] . '|' . $rule['id'];
                if (isset($existingKeys[$key])) {
                    $skippedCount++;
                    continue;
                }

                $scopeType    = $rule['assignment_scope_type'];
                $studentStart = ($scopeType === 'service')
                    ? ($student['start_date'] ?? null)
                    : ($student['enrollment_date'] ?? null);

                $proration = $prorationEnabled
                    ? ChargeProrationHelper::calculate((float) $rule['amount'], $periodStart, $periodEnd, $studentStart)
                    : ['amount' => (float) $rule['amount'], 'wasProrated' => false, 'remainingDays' => 0, 'totalDays' => 0];

                $baseAmount      = $proration['amount'];
                $bursaryStatus   = $student['bursary_status'] ?? 'none';
                $bursaryPct      = (int) ($student['bursary_percentage'] ?? 0);
                $bursaryDiscount = 0.0;

                if ($bursaryStatus !== 'none' && $bursaryPct > 0) {
                    $bursaryDiscount = round($baseAmount * $bursaryPct / 100, 2);
                }

                $finalAmount = round($baseAmount - $bursaryDiscount, 2);

                $description = $this->buildDescription($rule, $billingPeriod, $labels['descriptionLabel']);
                if ($proration['wasProrated']) {
                    $description .= sprintf(' – prorated %d/%d days', $proration['remainingDays'], $proration['totalDays']);
                }
                if ($bursaryDiscount > 0) {
                    $description .= sprintf(' – %d%% bursary', $bursaryPct);
                }

                $row = [
                    'id'             => 'chg_' . time() . '_' . bin2hex(random_bytes(6)),
                    'tenant_id'      => $tenantId,
                    'student_id'     => $student['id'],
                    'category'       => $this->resolveCategoryLabel($rule),
                    'amount'         => $finalAmount,
                    'date_generated' => $today,
                    'description'    => $description,
                    'created_by'     => $createdBy,
                    'fee_rule_id'    => $rule['id'],
                    'billing_period' => $billingPeriod,
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ];

                if ($this->fieldExists('charge_type'))      $row['charge_type']      = $this->mapChargeType($rule);
                if ($this->fieldExists('status'))           $row['status']           = 'pending';
                if ($this->fieldExists('term_id') && $term) $row['term_id']          = $term['id'];
                if ($this->fieldExists('term') && $term)    $row['term']             = $term['name'] ?? $term['id'];
                if ($this->fieldExists('academic_session')) $row['academic_session'] = $tenant['academic_session'] ?? null;
                if ($this->fieldExists('academic_year'))    $row['academic_year']    = $labels['academicYear'] ?? ($tenant['academic_session'] ?? null);
                if ($this->fieldExists('billing_run_id'))         $row['billing_run_id']         = $billingRunId;
                if ($this->fieldExists('bursary_discount_amount')) $row['bursary_discount_amount'] = $bursaryDiscount > 0 ? $bursaryDiscount : null;

                $pendingCharges[]                = $row;
                $existingKeys[$key]              = true; // guard against in-batch duplicates
                $generatedCount++;
                $chargedStudents[$student['id']] = true;
                $ruleGenerated++;
                $ruleAmount  += $finalAmount;
                $totalAmount += $finalAmount;

                if (count($pendingCharges) >= 250) {
                    $this->db->table('charges')->insertBatch($pendingCharges);
                    $pendingCharges = [];
                }
            }

            $perRule[] = [
                'feeRuleId'       => $rule['id'],
                'name'            => $rule['name'],
                'studentsCharged' => $ruleGenerated,
                'amount'          => round($ruleAmount, 2),
            ];
        }

        if (!empty($pendingCharges)) {
            $this->db->table('charges')->insertBatch($pendingCharges);
        }

        if ($generatedCount > 0) {
            $batchService->updateBillingRunTotals(
                $tenantId,
                $billingRunId,
                $generatedCount,
                count($chargedStudents),
                round($totalAmount, 2)
            );
        } else {
            $this->db->table('billing_runs')
                ->where('tenant_id', $tenantId)
                ->where('id', $billingRunId)
                ->delete();
            $billingRunId = null;
        }

        } catch (\Throwable $e) {
            $this->db->transRollback();
            throw $e;
        }

        $this->db->transComplete();
        if ($this->db->transStatus() === false) {
            throw new \RuntimeException('Charge generation transaction failed');
        }

        return [
            'billingPeriod'         => $billingPeriod,
            'batchId'               => $billingRunId,
            'descriptionLabel'      => $labels['descriptionLabel'],
            'generatedCount'        => $generatedCount,
            'skippedDuplicateCount' => $skippedCount,
            'totalAmount'           => round($totalAmount, 2),
            'perRule'               => $perRule,
        ];
    }

    // ──────────────────────────────────────────────────────────────
    // Unbilled alert
    // ──────────────────────────────────────────────────────────────

    /**
     * Count active students with no charges in the current billing period.
     * Used by the dashboard alert chip (FR-020/FR-021).
     */
    public function getUnbilledAlert(string $tenantId): array
    {
        $tenant = $this->loadTenant($tenantId);
        $cycle  = $this->resolveStructureType($tenant);

        $hasActiveTerm = true;
        if ($cycle === 'monthly') {
            $period = date('Y-m');
        } else {
            $calendar = $this->decodeJson($tenant['academic_calendar'] ?? null);
            $term     = $this->calendar->getCurrentTerm($calendar, date('Y-m-d'));
            $period   = $term['id'] ?? '';
            if ($period === '') {
                $hasActiveTerm = false;
            }
        }

        if ($period === '') {
            $eligible = (int) $this->db->table('students')
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->countAllResults();
            return [
                'hasActiveTerm'        => false,
                'billingPeriod'        => '',
                'eligibleStudentCount' => $eligible,
                'unbilledStudentCount' => 0,
            ];
        }

        $eligible = (int) $this->db->table('students')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->countAllResults();

        $billedQuery = $this->db->table('charges')
            ->select('student_id', false)
            ->where('tenant_id', $tenantId)
            ->where('billing_period', $period)
            ->where('fee_rule_id IS NOT NULL', null, false)
            ->where('deleted_at', null);

        // A voided charge does not count as "billed" for alert purposes; it
        // mirrors the convention used by ChargeModel/StudentModel/LedgerService.
        if ($this->fieldExists('voided_at')) {
            $billedQuery->where('voided_at', null);
        }

        $billed = (int) $billedQuery
            ->groupBy('student_id')
            ->countAllResults(false);

        return [
            'hasActiveTerm'        => true,
            'billingPeriod'        => $period,
            'eligibleStudentCount' => $eligible,
            'unbilledStudentCount' => max(0, $eligible - $billed),
        ];
    }

    // ──────────────────────────────────────────────────────────────
    // Eligible-student resolver
    // ──────────────────────────────────────────────────────────────

    /**
     * Given a fee rule, return the list of active students that the rule
     * applies to.
     *
     * Scope semantics:
     *   - school_wide: all active students.
     *   - class:       active students with class_id = scope_id.
     *   - category:    all active students (rule labels the charge category).
     *   - service:     active students with an active transport_assignment
     *                  (Feature 056 supports transport only for service scope).
     */
    public function getEligibleStudents(string $tenantId, array $rule): array
    {
        $type    = $rule['assignment_scope_type'];
        $scopeId = $rule['assignment_scope_id'] ?? null;

        if (!in_array($type, self::VALID_SCOPE_TYPES, true)) {
            return [];
        }

        $builder = $this->db->table('students')
            ->select('id, class_id, enrollment_date, bursary_status, bursary_percentage')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active');

        switch ($type) {
            case 'class':
                if (!$scopeId) return [];
                // Multi-class support (feature 057): decode JSON arrays into
                // PHP arrays and use whereIn for multi-class rules.
                $decoded = FeeRuleModel::decodeScopeId((string) $scopeId);
                if (is_array($decoded)) {
                    if (count($decoded) === 0) return [];
                    $builder->whereIn('class_id', $decoded);
                } else {
                    $builder->where('class_id', $decoded);
                }
                break;

            case 'student':
                if (!$scopeId) return [];
                // Specific-student scope: charge only the selected active
                // students. assignment_scope_id is a JSON array of student IDs.
                $decoded = FeeRuleModel::decodeScopeId((string) $scopeId);
                $ids     = is_array($decoded) ? $decoded : [$decoded];
                $ids     = array_values(array_filter($ids, fn($v) => is_string($v) && $v !== ''));
                if (count($ids) === 0) return [];
                $builder->whereIn('id', $ids);
                break;

            case 'service':
                if (!$scopeId) return [];
                $today = date('Y-m-d');
                // Restrict to students currently assigned to this specific
                // service (route). Without the route_id filter, every student
                // with any active transport assignment would be charged for
                // every service-scoped rule — see bugfix in commit history.
                // Also select start_date for proration (feature 060).
                $builder->select('(SELECT ta.start_date FROM transport_assignments ta WHERE ta.tenant_id = students.tenant_id AND ta.student_id = students.id AND ta.route_id = \'' . $this->db->escapeString($scopeId) . '\' LIMIT 1) AS start_date', false);
                $builder->whereIn('id', function ($sub) use ($tenantId, $today, $scopeId) {
                    return $sub->select('student_id')
                        ->from('transport_assignments')
                        ->where('tenant_id', $tenantId)
                        ->where('route_id', $scopeId)
                        ->groupStart()
                            ->where('end_date IS NULL', null, false)
                            ->orWhere('end_date >=', $today)
                        ->groupEnd();
                });
                break;

            case 'school_wide':
            case 'category':
                // No additional filter
                break;
        }

        return $builder->get()->getResultArray();
    }

    // ──────────────────────────────────────────────────────────────
    // Validation helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Confirm that $period is shaped correctly for the school's cycle.
     * Throws InvalidArgumentException on mismatch (controller maps → 422).
     */
    public function validateBillingPeriod(string $period, string $cycle, ?array $tenant = null): void
    {
        if ($cycle === 'monthly') {
            if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period)) {
                throw new InvalidArgumentException(
                    'billingPeriod must be in YYYY-MM format for monthly billing cycle'
                );
            }
            return;
        }

        // termly — must match a term ID in the academic calendar
        $calendar = $tenant ? $this->decodeJson($tenant['academic_calendar'] ?? null) : [];
        if (!$this->findTerm($calendar, $period)) {
            throw new InvalidArgumentException(
                "billingPeriod '{$period}' is not a valid term ID for this tenant"
            );
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Internals
    // ──────────────────────────────────────────────────────────────

    private function loadTenant(string $tenantId): array
    {
        $tenant = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        if (!$tenant) {
            throw new InvalidArgumentException('Tenant not found');
        }
        return $tenant;
    }

    private function resolveStructureType(array $tenant): string
    {
        $fee  = $this->decodeJson($tenant['fee_structure'] ?? null);
        $type = $fee['structureType'] ?? 'termly';
        return in_array($type, ['monthly', 'termly'], true) ? $type : 'termly';
    }

    private function decodeJson($value): array
    {
        if (is_array($value)) return $value;
        if (!$value)          return [];
        return json_decode($value, true) ?? [];
    }

    private function findTerm(array $calendar, string $termId): ?array
    {
        foreach ($calendar['terms'] ?? [] as $term) {
            if (($term['id'] ?? null) === $termId) {
                return $term;
            }
        }
        return null;
    }

    private function resolvePeriodStart(string $billingPeriod, string $cycle, ?array $term): string
    {
        if ($cycle === 'monthly') {
            return $billingPeriod . '-01';
        }
        return $term['start'] ?? $billingPeriod;
    }

    private function resolvePeriodEnd(string $billingPeriod, string $cycle, ?array $term): string
    {
        if ($cycle === 'monthly') {
            return date('Y-m-t', strtotime($billingPeriod . '-01'));
        }
        return $term['end'] ?? $billingPeriod;
    }

    private function buildMonthlyOptions(string $current): array
    {
        $options = [];
        $base    = \DateTime::createFromFormat('!Y-m', $current) ?: new \DateTime();
        // Show 2 months back, current, and 2 months ahead
        for ($offset = -2; $offset <= 2; $offset++) {
            $month = (clone $base)->modify(($offset >= 0 ? '+' : '') . $offset . ' month');
            $options[] = [
                'value' => $month->format('Y-m'),
                'label' => $month->format('F Y'),
            ];
        }
        return $options;
    }

    private function buildTermlyOptions(array $calendar): array
    {
        $options = [];
        foreach ($calendar['terms'] ?? [] as $term) {
            $options[] = [
                'value' => $term['id'] ?? '',
                'label' => $term['name'] ?? ($term['id'] ?? 'Term'),
            ];
        }
        return $options;
    }

    private function emptyResult(string $period): array
    {
        $labels = (new ChargeBatchRollbackService($this->db))->buildFeeRuleLabels($period);

        return [
            'billingPeriod'         => $period,
            'batchId'               => null,
            'descriptionLabel'      => $labels['descriptionLabel'],
            'generatedCount'        => 0,
            'skippedDuplicateCount' => 0,
            'totalAmount'           => 0.0,
            'perRule'               => [],
        ];
    }

    private function resolveCategoryLabel(array $rule): string
    {
        return $rule['assignment_scope_type'] === 'category'
            ? (string) ($rule['assignment_scope_id'] ?? $rule['name'])
            : (string) $rule['name'];
    }

    private function buildDescription(array $rule, string $period, ?string $descriptionLabel = null): string
    {
        return $descriptionLabel ?? sprintf('%s (%s)', $rule['name'], $period);
    }

    private function mapChargeType(array $rule): string
    {
        return 'fee_structure';
    }

    private function fieldExists(string $column): bool
    {
        static $cache = [];
        if (!isset($cache[$column])) {
            $cache[$column] = $this->db->fieldExists($column, 'charges');
        }
        return $cache[$column];
    }

    /**
     * Pre-fetch the (student_id, fee_rule_id) tuples already charged for the
     * given period so generateCharges() can skip duplicates without relying on
     * UNIQUE-constraint violations (which would otherwise rollback the entire
     * batch under CodeIgniter's strict transaction mode).
     *
     * @param string[] $ruleIds
     * @return array<string, true>  Keys formatted as "student_id|fee_rule_id".
     */
    private function fetchExistingChargeKeys(string $tenantId, array $ruleIds, string $billingPeriod): array
    {
        if (empty($ruleIds)) {
            return [];
        }

        $rows = $this->db->table('charges')
            ->select('student_id, fee_rule_id')
            ->where('tenant_id', $tenantId)
            ->where('billing_period', $billingPeriod)
            ->whereIn('fee_rule_id', $ruleIds)
            ->where('deleted_at', null);

        if ($this->fieldExists('voided_at')) {
            $rows->where('voided_at', null);
        }

        $rows = $rows->get()->getResultArray();

        $keys = [];
        foreach ($rows as $row) {
            $keys[$row['student_id'] . '|' . $row['fee_rule_id']] = true;
        }
        return $keys;
    }
}
