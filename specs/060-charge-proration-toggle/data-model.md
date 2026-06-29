# Data Model: Charge Proration Toggle (060)

## Schema Changes

**No new migrations required.** All state is stored in the existing `tenants.settings` JSON column (see D4 in research.md).

---

## Modified Entities

### `tenants.settings` (JSON column — additive key addition)

The `settings` JSON blob gains one new key:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `chargeProrationEnabled` | boolean | `false` | When `true`, charge generators apply day-fraction proration to mid-period enrollees. |

**Backward compatibility**: Existing tenants have no `chargeProrationEnabled` key in their `settings` JSON. Both the backend (`SettingsController`) and the billing engines treat a missing key as `false`, preserving current full-charge behaviour with zero data migration.

---

## Existing Entities Used (read-only for proration logic)

### `students`

| Column | Type | Purpose for proration |
|--------|------|----------------------|
| `id` | VARCHAR(50) | Student identifier |
| `tenant_id` | VARCHAR(50) | Tenant isolation |
| `enrollment_date` | DATE | **Proration start date** for fee-rule charges scoped to `school_wide`, `class`, `category`. |
| `status` | ENUM | Only `active` students are eligible (existing filter). |

### `transport_student_allocations`

| Column | Type | Purpose for proration |
|--------|------|----------------------|
| `student_id` | VARCHAR(50) | Links to student |
| `tenant_id` | VARCHAR(50) | Tenant isolation |
| `start_date` | DATE | **Proration start date** for transport monthly charges. |
| `route_id` | VARCHAR(50) | Route reference |
| `monthly_fee` | DECIMAL | Full charge amount before proration |

### `transport_assignments`

| Column | Type | Purpose for proration |
|--------|------|----------------------|
| `student_id` | VARCHAR(50) | Links to student |
| `tenant_id` | VARCHAR(50) | Tenant isolation |
| `start_date` | DATE | **Proration start date** for service-scoped fee-rule charges. |
| `route_id` | VARCHAR(50) | Route reference used to match eligible students |

### `charges`

| Column | Type | Change |
|--------|------|--------|
| `description` | TEXT | **Appended** with `– prorated X/Y days` when charge is prorated. No schema change. |
| `amount` | DECIMAL | Stores the prorated amount (may be less than the fee rule's `amount`). No schema change. |

---

## Proration Formula Reference

```
remaining_days     = (period_end_date - effective_start_date) + 1
total_days         = (period_end_date - period_start_date) + 1
effective_start    = max(period_start_date, student_start_date)

prorated_amount    = floor(remaining_days / total_days × full_amount)
```

**Period boundaries**:
- Monthly billing: `period_start = YYYY-MM-01`, `period_end = last day of month`
- Termly billing: `period_start = term.start_date`, `period_end = term.end_date` (from academic calendar JSON)

**Fallback**: If `student_start_date` is null, `effective_start = period_start_date` → full charge.

---

## New Service

### `App\Services\ChargeProrationHelper`

A stateless helper class. No database interaction; no constructor dependencies.

| Method | Signature | Description |
|--------|-----------|-------------|
| `calculate` | `static calculate(float $fullAmount, string $periodStart, string $periodEnd, ?string $studentStart): ProrationResult` | Returns `ProrationResult` with `amount`, `wasProrated`, `remainingDays`, `totalDays`. |

**`ProrationResult` shape** (plain PHP array / value object):

```php
[
  'amount'       => float,   // prorated (or full) amount
  'wasProrated'  => bool,    // true if amount < fullAmount
  'remainingDays'=> int,     // days from effective start to period end (inclusive)
  'totalDays'    => int,     // total days in billing period
]
```

---

## Modified Service: `FeeRuleBillingService`

Changes scoped to `generateCharges()` and `getEligibleStudents()`:

- `generateCharges()`: reads `chargeProrationEnabled` from tenant settings before the loop; passes it to a per-student proration call via `ChargeProrationHelper::calculate()`.
- `getEligibleStudents()` for `service` scope: extends the SELECT to include `ta.start_date` so the billing loop has the assignment start date available.
- For `school_wide`, `class`, `category` scopes: the student's `enrollment_date` is already in the students query result; extend SELECT to include it.

## Modified Controller: `TransportController::generateMonthlyCharges()`

- After loading tenant, reads `chargeProrationEnabled` from `tenants.settings`.
- Before inserting each charge, calls `ChargeProrationHelper::calculate($monthlyFee, $monthStart, $monthEnd, $a['start_date'])`.
- Uses `result['amount']` as the inserted `amount`; appends proration annotation to `description` when `result['wasProrated']` is true.

## Modified Controller: `SettingsController`

- `index()`: includes `chargeProrationEnabled` in the response (default `false`).
- `update()`: accepts and persists `chargeProrationEnabled` as a boolean.
- `DEFAULT_SETTINGS`: gains `'chargeProrationEnabled' => false`.

## Modified Frontend Types / API

- `Settings` interface (`types/dashboard.ts`): gains `chargeProrationEnabled?: boolean`.
- `api.ts` `saveSettings()`: already passes the full settings object; no change needed.
- `FeeStructureTab.tsx`: new `ChargeProrationCard` component (or inline card) with a `Switch`.
- `Settings.tsx`: add `/settings/fee-structure` route + sidebar entry.
