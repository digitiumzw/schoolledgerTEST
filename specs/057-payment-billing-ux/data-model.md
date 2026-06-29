# Data Model: Payment & Billing UX Improvements

**Feature**: `057-payment-billing-ux` | **Branch**: `057-payment-billing-ux`  
**Phase**: 1 — Design  
**Depends on**: `research.md` decisions D2, D4, D5

---

## Overview

This feature requires **two additive migrations** to the `payments` table and **one column-type migration** to `fee_rules`. No tables are created or dropped. All migrations are idempotent (guarded with `fieldExists` / `tableExists` checks).

---

## Migration 1 — Add `receipt_number` and `snapshot` to `payments`

**File**: `backend/app/Database/Migrations/2026-05-04-000001_Add_receipt_number_and_snapshot_to_payments.php`

### Schema change

```
payments
├── id                    VARCHAR(50)   PK
├── tenant_id             VARCHAR(50)
├── student_id            VARCHAR(50)
├── amount                DECIMAL(10,2)
├── date                  DATE
├── method                VARCHAR(50)
├── description           TEXT NULL
├── category              VARCHAR(50)
├── route_id              VARCHAR(50)  NULL
├── balance_after_payment DECIMAL(12,2) NULL   ← existing (feature 056 migration)
├── receipt_number        VARCHAR(25)  NULL    ← NEW (D4)
├── snapshot              JSON         NULL    ← NEW (D5)
├── created_at            DATETIME NULL
└── updated_at            DATETIME NULL
```

### `receipt_number`

- Format: `YYYY.MM.DD.HHmmss.X` where X is a random uppercase letter A–Z.
- Generated server-side in `PaymentController::create()` immediately before insert.
- Example: `2026.05.04.143022.K`
- `NULL` for legacy payments; displayed as fallback to payment ID on receipt.
- **Unique index**: `uq_payments_receipt_number` on `(tenant_id, receipt_number)` — enforces no collisions per tenant.

### `snapshot`

- Type: `JSON NULL` (MySQL 5.7.8+ / MariaDB 10.2.7+ native JSON).
- Populated atomically in the same transaction as the payment insert.
- Shape:
```json
{
  "studentName":   "Alice Moyo",
  "className":     "Form 3A",
  "balanceBefore": 120.00,
  "paymentMethod": "Cash",
  "paymentDate":   "2026-05-04",
  "amount":        80.00,
  "category":      "Fees"
}
```
- `balanceBefore` = ledger balance **before** this payment is applied (fetched from `LedgerService::getStudentBalance()` before the insert, inside the transaction).
- Legacy rows without a `snapshot` column: `ReceiptController::show()` falls back to the live JOIN.

### Migration PHP skeleton

```php
public function up(): void
{
    if (!$this->db->fieldExists('receipt_number', 'payments')) {
        $this->forge->addColumn('payments', [
            'receipt_number' => [
                'type'       => 'VARCHAR',
                'constraint' => 25,
                'null'       => true,
                'default'    => null,
                'after'      => 'balance_after_payment',
            ],
        ]);
    }

    if (!$this->db->fieldExists('snapshot', 'payments')) {
        $this->forge->addColumn('payments', [
            'snapshot' => [
                'type'  => 'JSON',
                'null'  => true,
                'after' => 'receipt_number',
            ],
        ]);
    }

    // Unique index — safe to add after column creation
    $this->db->query('
        CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_receipt_number
        ON payments (tenant_id, receipt_number)
    ');
}

public function down(): void
{
    $this->db->query('DROP INDEX IF EXISTS uq_payments_receipt_number ON payments');
    $this->forge->dropColumn('payments', ['receipt_number', 'snapshot']);
}
```

---

## Migration 2 — Widen `fee_rules.assignment_scope_id` to TEXT

**File**: `backend/app/Database/Migrations/2026-05-04-000002_Widen_fee_rule_scope_id_to_text.php`

**Rationale** (D2): Multi-class fee rules store a JSON array of class IDs in this column. The existing `VARCHAR(50)` cannot hold multiple IDs.

### Schema change

```
fee_rules
├── id                      VARCHAR(50)   PK
├── tenant_id               VARCHAR(50)
├── name                    VARCHAR(255)
├── amount                  DECIMAL(12,2)
├── assignment_scope_type   ENUM('school_wide','class','category','service')
├── assignment_scope_id     TEXT NULL     ← widened from VARCHAR(50) (D2)
├── is_active               TINYINT(1)
├── created_by              VARCHAR(50) NULL
├── created_at              DATETIME NULL
└── updated_at              DATETIME NULL
```

### Encoding convention

| Rule type | `assignment_scope_id` value | Example |
|---|---|---|
| `school_wide` | `NULL` | — |
| `class` (single) | plain class ID string | `"cls_abc123"` |
| `class` (multi) | JSON array of class IDs | `'["cls_abc","cls_def"]'` |
| `category` | category key string | `"Tuition"` |
| `service` | service key string | `"transport"` |

Detection logic in PHP: `json_decode($scopeId, true)` — if the result is an array, treat as multi-class; otherwise treat as plain scalar.

### Migration PHP skeleton

```php
public function up(): void
{
    // MODIFY is idempotent — TEXT is a superset of VARCHAR(50)
    $this->db->query('
        ALTER TABLE fee_rules
        MODIFY COLUMN assignment_scope_id TEXT NULL
        COMMENT "single class ID, JSON array of class IDs, category key, or service key. NULL = school_wide"
    ');
}

public function down(): void
{
    // Truncation risk: only safe if no multi-class rules exist
    $this->db->query('
        ALTER TABLE fee_rules
        MODIFY COLUMN assignment_scope_id VARCHAR(50) NULL
    ');
}
```

---

## Affected Models

### `PaymentModel`

- Add `receipt_number` and `snapshot` to `$allowedFields`.
- Update `formatForApi()`:
  - Include `receiptNumber` (string|null).
  - Include `snapshot` (decoded JSON array|null).
- Update `formatFromApi()`:
  - Accept `receiptNumber` (not mapped from client — generated server-side only).

### `FeeRuleModel`

- `$allowedFields`: `assignment_scope_id` already present — no change needed (TEXT is handled by CI4 transparently).
- `buildScopeLabel()`: Change class branch to return `"class:{$scopeId}"` (machine-readable prefix) so the frontend can distinguish a label from a raw ID/array.
- Add `decodeScopeId(string $raw): string|array`: decodes JSON arrays, returns scalar otherwise.

### `FeeRuleBillingService`

- `getEligibleStudents()` class branch: decode `assignment_scope_id` — if array, use `whereIn('class_id', $ids)`; if scalar, use `where('class_id', $id)`.

---

## Frontend Type Changes (`api.ts`)

```typescript
// Before
export interface FeeRule {
  assignmentScopeId: string | null;
  // ...
}

export interface FeeRuleInput {
  assignmentScopeId?: string | null;
  // ...
}

// After
export interface FeeRule {
  assignmentScopeId: string | string[] | null;   // multi-class support
  // ...
}

export interface FeeRuleInput {
  assignmentScopeId?: string | string[] | null;  // send array for multi-class
  // ...
}

// Extended Payment interface
export interface Payment {
  // existing fields ...
  receiptNumber: string | null;
  snapshot: PaymentSnapshot | null;
}

export interface PaymentSnapshot {
  studentName:   string;
  className:     string;
  balanceBefore: number;
  paymentMethod: string;
  paymentDate:   string;
  amount:        number;
  category:      string;
}
```

---

## System Payment Categories (no migration — constants only)

Defined as a shared constant in both backend (PHP) and frontend (TypeScript):

```php
// backend/app/Config/PaymentCategories.php  (new file)
const SYSTEM_CATEGORIES = [
    ['id' => '__fees',            'name' => 'Fees',             'system' => true],
    ['id' => '__transport',       'name' => 'Transport',        'system' => true],
    ['id' => '__transport_fees',  'name' => 'Transport + Fees', 'system' => true],
];
```

```typescript
// frontend/src/constants/paymentCategories.ts  (new file)
export const SYSTEM_PAYMENT_CATEGORIES = [
  { id: '__fees',           name: 'Fees',             system: true },
  { id: '__transport',      name: 'Transport',        system: true },
  { id: '__transport_fees', name: 'Transport + Fees', system: true },
] as const;
```

`SettingsController::getPaymentCategories()` prepends system categories to the response; `createPaymentCategory` / `updatePaymentCategory` / `deletePaymentCategory` reject requests where `name` matches any system category name (case-insensitive).

---

## No-Change Summary

| Entity | Reason unchanged |
|---|---|
| `charges` table | No schema changes required for this feature |
| `LedgerService` | Allocation routing by `route_id` is unchanged (D7) |
| `transport_assignments` | Out of scope |
| `classes` | Out of scope — class name resolved client-side (D6) |
