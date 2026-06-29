<?php

namespace App\Controllers\Api;

use App\Models\FeeRuleModel;
use App\Services\AcademicCalendarService;
use App\Services\ChargeBatchRollbackService;
use App\Services\FeeRuleBillingService;
use CodeIgniter\Database\Config;

/**
 * FeeRuleController — CRUD for billing rules and the trigger endpoints used
 * by the Fee Structure & Billing Engine (Feature 056).
 *
 * Endpoints:
 *   GET    /api/fee-rules                     — list (admin + bursar read)
 *   POST   /api/fee-rules                     — create (admin only)
 *   PUT    /api/fee-rules/:id                 — update (admin only)
 *   DELETE /api/fee-rules/:id                 — delete (admin only)
 *   GET    /api/fee-rules/billing-meta        — current billing cycle metadata
 *   POST   /api/fee-rules/generate            — generate charges (admin + bursar)
 *   GET    /api/fee-rules/unbilled-alert      — unbilled student count (admin + bursar)
 */
class FeeRuleController extends BaseApiController
{
    private const VALID_SCOPES = ['school_wide', 'class', 'category', 'service', 'student'];

    /** Scopes whose assignment_scope_id may hold a JSON array of IDs. */
    private const MULTI_ID_SCOPES = ['class', 'student'];

    protected $db;
    protected FeeRuleModel $rules;

    public function initController(
        \CodeIgniter\HTTP\RequestInterface $request,
        \CodeIgniter\HTTP\ResponseInterface $response,
        \Psr\Log\LoggerInterface $logger
    ) {
        parent::initController($request, $response, $logger);
        $this->db    = Config::connect();
        $this->rules = new FeeRuleModel();
    }

    // ──────────────────────────────────────────────────────────────
    // CRUD
    // ──────────────────────────────────────────────────────────────

    /** GET /api/fee-rules — list rules for the current tenant. */
    public function index()
    {
        if ($denied = $this->requireRole('admin', 'bursar', 'super_admin')) {
            return $denied;
        }

        $tenantId = $this->getTenantId();
        $rows     = $this->rules->getByTenant($tenantId);

        return $this->success(array_map(fn($r) => $this->rules->formatForApi($r), $rows));
    }

    /** POST /api/fee-rules — create a new rule (admin only). */
    public function store()
    {
        if ($denied = $this->requireRole('admin', 'super_admin')) {
            return $denied;
        }

        $tenantId = $this->getTenantId();
        $data     = $this->getRequestBody();

        if ($missing = $this->requireFields($data, ['name', 'amount', 'assignmentScopeType'])) {
            return $missing;
        }

        if ($err = $this->validatePayload($data, $tenantId, null)) {
            return $err;
        }

        $id  = $this->generateId('frl_');
        $row = [
            'id'                    => $id,
            'tenant_id'             => $tenantId,
            'name'                  => $this->sanitiseString($data['name']),
            'amount'                => (float) $data['amount'],
            'assignment_scope_type' => $data['assignmentScopeType'],
            'assignment_scope_id'   => $this->normaliseScopeId($data),
            'is_active'             => isset($data['isActive']) ? (int) (bool) $data['isActive'] : 1,
            'created_by'            => $this->getCurrentUser()->userId ?? null,
        ];

        try {
            $this->rules->insert($row);
        } catch (\Throwable $e) {
            log_message('error', 'FeeRuleController::store failed: ' . $e->getMessage());
            return $this->serverError('Failed to create fee rule');
        }

        $created = $this->rules->findByIdAndTenant($id, $tenantId);
        return $this->created($this->rules->formatForApi($created));
    }

    /** PUT /api/fee-rules/:id — update an existing rule (admin only). */
    public function update($id = null)
    {
        if ($denied = $this->requireRole('admin', 'super_admin')) {
            return $denied;
        }
        if (!$id) {
            return $this->error('Fee rule ID is required', 400);
        }

        $tenantId = $this->getTenantId();
        $existing = $this->rules->findByIdAndTenant($id, $tenantId);
        if (!$existing) {
            return $this->notFound('Fee rule not found');
        }

        $data = $this->getRequestBody();

        if ($err = $this->validatePayload($data, $tenantId, $id, $existing)) {
            return $err;
        }

        $update = [];
        if (isset($data['name']))                $update['name']                  = $this->sanitiseString($data['name']);
        if (isset($data['amount']))              $update['amount']                = (float) $data['amount'];
        if (isset($data['assignmentScopeType'])) $update['assignment_scope_type'] = $data['assignmentScopeType'];
        if (array_key_exists('assignmentScopeId', $data) || isset($data['assignmentScopeType'])) {
            $update['assignment_scope_id'] = $this->normaliseScopeId(array_merge($existing, [
                'assignment_scope_type' => $data['assignmentScopeType'] ?? $existing['assignment_scope_type'],
                'assignmentScopeType'   => $data['assignmentScopeType'] ?? $existing['assignment_scope_type'],
                'assignmentScopeId'     => $data['assignmentScopeId']   ?? $existing['assignment_scope_id'],
            ]));
        }
        if (isset($data['isActive'])) $update['is_active'] = (int) (bool) $data['isActive'];

        if (empty($update)) {
            return $this->success($this->rules->formatForApi($existing), 'No changes');
        }

        try {
            $this->rules->update($id, $update);
        } catch (\Throwable $e) {
            log_message('error', 'FeeRuleController::update failed: ' . $e->getMessage());
            return $this->serverError('Failed to update fee rule');
        }

        $updated = $this->rules->findByIdAndTenant($id, $tenantId);
        return $this->success($this->rules->formatForApi($updated), 'Fee rule updated');
    }

    /** DELETE /api/fee-rules/:id — hard delete a rule (admin only).
     *  Existing charges keep their fee_rule_id reference (no FK cascade), so
     *  historical data is preserved.
     */
    public function destroy($id = null)
    {
        if ($denied = $this->requireRole('admin', 'super_admin')) {
            return $denied;
        }
        if (!$id) {
            return $this->error('Fee rule ID is required', 400);
        }

        $tenantId = $this->getTenantId();
        $existing = $this->rules->findByIdAndTenant($id, $tenantId);
        if (!$existing) {
            return $this->notFound('Fee rule not found');
        }

        try {
            $this->rules->delete($id);
        } catch (\Throwable $e) {
            log_message('error', 'FeeRuleController::destroy failed: ' . $e->getMessage());
            return $this->serverError('Failed to delete fee rule');
        }

        return $this->success(['id' => $id], 'Fee rule deleted');
    }

    // ──────────────────────────────────────────────────────────────
    // Billing engine endpoints
    // ──────────────────────────────────────────────────────────────

    /** GET /api/fee-rules/billing-meta — return billing cycle and available periods. */
    public function billingMeta()
    {
        if ($denied = $this->requireRole('admin', 'bursar', 'super_admin')) {
            return $denied;
        }

        $tenantId = $this->getTenantId();
        $service  = new FeeRuleBillingService($this->db);

        return $this->success($service->getBillingMeta($tenantId));
    }

    /** POST /api/fee-rules/generate — run charge generation for the period. */
    public function generate()
    {
        if ($denied = $this->requireRole('admin', 'bursar', 'super_admin')) {
            return $denied;
        }

        $tenantId = $this->getTenantId();
        $data     = $this->getRequestBody();

        if ($missing = $this->requireFields($data, ['billingPeriod'])) {
            return $missing;
        }

        $service = new FeeRuleBillingService($this->db);
        try {
            $result = $service->generateCharges(
                $tenantId,
                (string) $data['billingPeriod'],
                $data['feeRuleIds'] ?? null,
                $this->getCurrentUser()->userId ?? null
            );
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        } catch (\Throwable $e) {
            log_message('error', 'FeeRuleController::generate failed: ' . $e->getMessage());
            return $this->serverError('Failed to generate charges');
        }

        return $this->success($result, 'Charges generated');
    }

    public function latestChargeBatch()
    {
        if ($denied = $this->requireRole('admin', 'bursar', 'super_admin')) {
            return $denied;
        }

        $tenantId = $this->getTenantId();
        $service  = new ChargeBatchRollbackService($this->db);
        $batch    = $service->getLatestBatch($tenantId, ChargeBatchRollbackService::FEE_RULE_CHARGE_TYPE);

        if (!$batch) {
            return $this->notFound('No active fee rule charge batch exists');
        }

        return $this->success($batch, 'Latest fee rule charge batch retrieved');
    }

    public function voidLatestChargeBatch()
    {
        if ($denied = $this->requireRole('admin', 'bursar', 'super_admin')) {
            return $denied;
        }

        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();
        $service  = new ChargeBatchRollbackService($this->db);

        try {
            $result = $service->voidLatestBatch(
                $tenantId,
                ChargeBatchRollbackService::FEE_RULE_CHARGE_TYPE,
                $this->getCurrentUser()->userId ?? null,
                $body['reason'] ?? null
            );
        } catch (\RuntimeException $e) {
            if ($e->getMessage() === 'NO_ACTIVE_BATCH') {
                return $this->notFound('No active fee rule charge batch exists');
            }
            if ($e->getMessage() === 'BATCH_CHANGED') {
                return $this->error('Latest fee rule charge batch was already voided or changed', 409);
            }
            throw $e;
        } catch (\Throwable $e) {
            log_message('error', 'FeeRuleController::voidLatestChargeBatch failed: ' . $e->getMessage());
            return $this->serverError('Failed to void latest fee rule charge batch');
        }

        return $this->success($result, 'Latest fee rule charge batch voided');
    }

    /** GET /api/fee-rules/unbilled-alert — count students with no charges this period. */
    public function unbilledAlert()
    {
        if ($denied = $this->requireRole('admin', 'bursar', 'super_admin')) {
            return $denied;
        }

        $tenantId = $this->getTenantId();
        $service  = new FeeRuleBillingService($this->db);

        return $this->success($service->getUnbilledAlert($tenantId));
    }

    // ──────────────────────────────────────────────────────────────
    // Validation helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Validate a create/update payload. Returns an error response or null.
     */
    private function validatePayload(array $data, string $tenantId, ?string $excludeId, ?array $existing = null)
    {
        if (isset($data['amount']) && (!is_numeric($data['amount']) || (float) $data['amount'] < 0)) {
            return $this->error('Amount must be a non-negative number', 422);
        }

        if (isset($data['assignmentScopeType'])
            && !in_array($data['assignmentScopeType'], self::VALID_SCOPES, true)) {
            return $this->error(
                'assignmentScopeType must be one of: ' . implode(', ', self::VALID_SCOPES),
                422
            );
        }

        $scopeType = $data['assignmentScopeType'] ?? ($existing['assignment_scope_type'] ?? null);
        $scopeId   = $data['assignmentScopeId']   ?? ($existing['assignment_scope_id']   ?? null);

        // Multi-ID scopes (feature 057 multi-class, and student scope):
        // assignmentScopeId may be an array of IDs.
        $isMultiScope = in_array($scopeType, self::MULTI_ID_SCOPES, true);
        if ($isMultiScope && is_array($scopeId)) {
            if (count($scopeId) === 0) {
                return $this->error("assignmentScopeId is required for scope type '{$scopeType}'", 422);
            }
            foreach ($scopeId as $cid) {
                if (!is_string($cid) || trim($cid) === '') {
                    return $this->error('assignmentScopeId array entries must be non-empty strings', 422);
                }
            }
        } elseif ($scopeType && $scopeType !== 'school_wide' && empty($scopeId)) {
            return $this->error("assignmentScopeId is required for scope type '{$scopeType}'", 422);
        } elseif (!$isMultiScope && is_array($scopeId)) {
            return $this->error("assignmentScopeId must be a string for scope type '{$scopeType}'", 422);
        }

        if (isset($data['name'])) {
            $name = $this->sanitiseString($data['name']);
            if ($name === '') {
                return $this->error('Name cannot be empty', 422);
            }
            if ($this->rules->nameExistsForTenant($tenantId, $name, $excludeId)) {
                return $this->error('A fee rule with this name already exists', 409);
            }
        }

        return null;
    }

    /**
     * For school_wide scope force the scope ID to NULL.
     * Accepts both camelCase (API) and snake_case (DB row) keys.
     *
     * Multi-class support (feature 057): when scope is 'class' and the
     * incoming value is an array, JSON-encode it for storage.
     */
    private function normaliseScopeId(array $data): ?string
    {
        $type = $data['assignmentScopeType'] ?? $data['assignment_scope_type'] ?? null;
        if ($type === 'school_wide') {
            return null;
        }
        $id = $data['assignmentScopeId'] ?? $data['assignment_scope_id'] ?? null;
        if (is_array($id)) {
            // Filter empty entries and re-index to avoid sparse arrays in JSON
            $clean = array_values(array_filter($id, fn($v) => is_string($v) && trim($v) !== ''));
            if (count($clean) === 0) {
                return null;
            }
            return json_encode($clean);
        }
        return $id !== null && $id !== '' ? (string) $id : null;
    }
}
