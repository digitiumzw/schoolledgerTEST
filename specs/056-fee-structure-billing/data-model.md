# Data Model: School Fee Structure & Billing Engine

**Branch**: `056-fee-structure-billing` | **Date**: 2026-05-01

## New Table: `fee_rules`

Stores named billing instructions that the billing engine evaluates during charge generation.

```sql
CREATE TABLE fee_rules (
    id                    VARCHAR(50)  NOT NULL,
    tenant_id             VARCHAR(50)  NOT NULL,
    name                  VARCHAR(255) NOT NULL,
    amount                DECIMAL(12,2) NOT NULL,
    assignment_scope_type ENUM('school_wide','class','category','service') NOT NULL,
    assignment_scope_id   VARCHAR(50)  NULL,          -- NULL when scope = 'school_wide'
    is_active             TINYINT(1)   NOT NULL DEFAULT 1,
    created_by            VARCHAR(50)  NULL,
    created_at            DATETIME     NULL,
    updated_at            DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_fee_rules_tenant_name (tenant_id, name),
    INDEX idx_fee_rules_tenant_active (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Field Rules

| Field | Constraint | Notes |
|-------|-----------|-------|
| `id` | PK, application-generated | Prefix: `fr-` |
| `tenant_id` | NOT NULL, FK tenants.id | Enforces multi-tenant isolation |
| `name` | NOT NULL, UNIQUE per tenant | e.g., "Tuition", "Library Fee" |
| `amount` | NOT NULL, > 0 | Validated at API level before insert |
| `assignment_scope_type` | ENUM | `school_wide` → `assignment_scope_id` must be NULL; others must provide a valid scope ID |
| `assignment_scope_id` | NULL allowed | FK value pointing to class.id, student category name, or service key |
| `is_active` | DEFAULT 1 | Soft-disable; deleted rules set `is_active = 0` OR hard-deleted (spec FR-003 says deletion must not affect past charges — hard delete is safe since charges retain `fee_rule_id` as a snapshot) |

---

## Modified Table: `charges` (additive columns)

Two new nullable columns added to the existing `charges` table. All existing rows remain valid (columns default to NULL, backward compatible).

### New Columns

```sql
ALTER TABLE charges
    ADD COLUMN fee_rule_id   VARCHAR(50) NULL AFTER billing_run_id,
    ADD COLUMN billing_period VARCHAR(20) NULL AFTER fee_rule_id;
```

### New Unique Constraint (deduplication)

```sql
ALTER TABLE charges
    ADD UNIQUE KEY uq_charges_student_rule_period (student_id, fee_rule_id, billing_period);
```

> **Note**: MySQL treats NULL values as distinct in UNIQUE indexes. Charges with `fee_rule_id = NULL` (all legacy charges) are exempt from this constraint and will never conflict.

### New Index (alert query performance)

```sql
CREATE INDEX idx_charges_tenant_rule_period
    ON charges (tenant_id, fee_rule_id, billing_period);
```

### `billing_period` Format

| Billing Cycle | Format | Example |
|--------------|--------|---------|
| Monthly | `YYYY-MM` | `2026-04` |
| Termly | Term ID string | `term-1-2025` |

---

## Unchanged Tables (referenced, not modified)

| Table | Role in this feature |
|-------|---------------------|
| `tenants` | Source of `fee_structure.structureType` (billing cycle) and `academic_calendar` (active term lookup) |
| `students` | Eligible student pool; filtered by `status = 'active'`, `tenant_id`, and optionally `class_id` or `category` |
| `classes` | Resolved for `assignment_scope_type = 'class'` rules |
| `transport_assignments` | Queried for `assignment_scope_type = 'service'` (transport) — P2 only |
| `billing_runs` | Pre-existing tracking table; NOT used by the new billing engine (new engine tracks via `fee_rule_id + billing_period` on charges directly) |

---

## Entity Relationships

```
tenants
  ├── fee_rules (1:N, tenant_id)
  └── students (1:N, tenant_id)
        └── charges (1:N, student_id)
                ├── fee_rule_id → fee_rules.id  [nullable FK, snapshot]
                └── billing_period              [YYYY-MM or term_id]

fee_rules
  ├── assignment_scope_id → classes.id         [when scope = 'class']
  ├── assignment_scope_id → (category string)  [when scope = 'category']
  └── assignment_scope_id → (service key)      [when scope = 'service']
```

---

## Value Object: GenerationResult (transient, not persisted)

Returned by `FeeRuleBillingService::generateCharges()` and serialised to the API response.

```php
[
    'billingPeriod'   => string,   // e.g., "2026-04" or "term-1-2025"
    'chargesCreated'  => int,
    'studentsBilled'  => int,
    'studentsSkipped' => int,
    'totalAmount'     => float,
    'skippedDetails'  => [         // per-rule breakdown of skips
        ['feeRuleName' => string, 'studentId' => string, 'reason' => string],
        ...
    ],
    'ruleBreakdown'   => [         // per-rule summary
        ['feeRuleId' => string, 'feeRuleName' => string, 'charged' => int, 'skipped' => int, 'subtotal' => float],
        ...
    ],
]
```

---

## Validation Rules

| Rule | Scope | Enforcement |
|------|-------|-------------|
| `name` not empty | FeeRule create/update | Service layer + DB NOT NULL |
| `amount` > 0 | FeeRule create/update | Service layer |
| `assignment_scope_type` valid ENUM | FeeRule create/update | DB ENUM + service validation |
| `assignment_scope_id` required when scope ≠ `school_wide` | FeeRule create | Service layer |
| `assignment_scope_id` NULL when scope = `school_wide` | FeeRule create | Service layer |
| `billing_period` type matches school's `structureType` | Generation request | Service layer (rejects mismatched period type with 422) |
| Generation: admin or bursar role only | API request | Controller role check |
| Fee rule CRUD: admin role only | API request | Controller role check |
