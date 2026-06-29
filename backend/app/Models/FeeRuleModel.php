<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * FeeRuleModel — billing rules for manual charge generation.
 *
 * Feature: 056-fee-structure-billing
 *
 * Each fee rule specifies a fixed amount, a name, and an assignment scope
 * (school-wide, class, category, or service). The FeeRuleBillingService
 * evaluates all active rules for a tenant during a generation run.
 */
class FeeRuleModel extends Model
{
    protected $table            = 'fee_rules';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useTimestamps    = true;
    protected $useSoftDeletes   = false;

    protected $allowedFields = [
        'id',
        'tenant_id',
        'name',
        'amount',
        'assignment_scope_type',
        'assignment_scope_id',
        'is_active',
        'created_by',
        'created_at',
        'updated_at',
    ];

    // ──────────────────────────────────────────────────────────────
    // Queries
    // ──────────────────────────────────────────────────────────────

    /**
     * Return all fee rules for a tenant (active + inactive).
     */
    public function getByTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->orderBy('name', 'ASC')
            ->findAll();
    }

    /**
     * Return only active fee rules for a tenant — used by the billing engine.
     */
    public function getActiveByTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('is_active', 1)
            ->orderBy('name', 'ASC')
            ->findAll();
    }

    /**
     * Find a rule by ID but only if it belongs to the given tenant.
     * Returns null if not found or cross-tenant access attempt.
     */
    public function findByIdAndTenant(string $id, string $tenantId): ?array
    {
        $row = $this->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        return $row ?: null;
    }

    /**
     * Check whether a rule with the given name already exists for the tenant.
     * $excludeId lets update operations ignore the row being edited.
     */
    public function nameExistsForTenant(string $tenantId, string $name, ?string $excludeId = null): bool
    {
        $builder = $this->where('tenant_id', $tenantId)
            ->where('name', $name);

        if ($excludeId !== null) {
            $builder->where('id !=', $excludeId);
        }

        return $builder->countAllResults() > 0;
    }

    // ──────────────────────────────────────────────────────────────
    // Formatting
    // ──────────────────────────────────────────────────────────────

    /**
     * Format a DB row for API response (snake_case → camelCase).
     *
     * For class-scoped rules, `assignmentScopeId` is decoded into a string[]
     * when the stored value is a JSON array (feature 057 multi-class scope).
     */
    public function formatForApi(array $rule): array
    {
        $scopeType = $rule['assignment_scope_type'];
        $rawScope  = $rule['assignment_scope_id'] ?? null;
        $isMulti   = in_array($scopeType, ['class', 'student'], true);
        $scopeId   = $isMulti ? self::decodeScopeId($rawScope) : $rawScope;

        return [
            'id'                   => $rule['id'],
            'name'                 => $rule['name'],
            'amount'               => (float) $rule['amount'],
            'assignmentScopeType'  => $scopeType,
            'assignmentScopeId'    => $scopeId,
            'assignmentScopeLabel' => $this->buildScopeLabel($scopeType, $rawScope),
            'isActive'             => (bool) ($rule['is_active'] ?? 1),
            'createdAt'            => $rule['created_at'] ?? null,
            'updatedAt'            => $rule['updated_at'] ?? null,
        ];
    }

    /**
     * Decode an assignment_scope_id value.
     *
     * Returns an array<string> when the raw value is a JSON array of class IDs
     * (multi-class scope, feature 057). Returns the scalar string unchanged for
     * single-class / category / service scopes. Returns null when unset.
     *
     * @return string|string[]|null
     */
    public static function decodeScopeId(?string $raw)
    {
        if ($raw === null || $raw === '') {
            return null;
        }
        $trimmed = trim($raw);
        if ($trimmed === '' || $trimmed[0] !== '[') {
            return $raw;
        }
        $decoded = json_decode($trimmed, true);
        if (is_array($decoded)) {
            // Ensure all entries are strings
            $clean = [];
            foreach ($decoded as $v) {
                if (is_string($v) && $v !== '') {
                    $clean[] = $v;
                }
            }
            return $clean;
        }
        return $raw;
    }

    /**
     * Produce a machine-readable label for the assignment scope.
     *
     * For class scope, the label uses a "class:{scopeId}" prefix so the
     * frontend can parse it and resolve class IDs to human-readable names
     * from its local class list (feature 057 D6). The raw scopeId is
     * preserved verbatim (may be a single ID or a JSON array string).
     */
    private function buildScopeLabel(string $scopeType, ?string $scopeId): string
    {
        switch ($scopeType) {
            case 'school_wide':
                return 'All Students';
            case 'class':
                return $scopeId !== null && $scopeId !== ''
                    ? "class:{$scopeId}"
                    : 'Class';
            case 'student':
                if ($scopeId === null || $scopeId === '') {
                    return 'Specific students';
                }
                $decoded = self::decodeScopeId($scopeId);
                $count   = is_array($decoded) ? count($decoded) : 1;
                return "student:{$count}";
            case 'category':
                return $scopeId ? "Category: {$scopeId}" : 'Category';
            case 'service':
                return $scopeId ? "Service: {$scopeId}" : 'Service';
            default:
                return $scopeType;
        }
    }
}
