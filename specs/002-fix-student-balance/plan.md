# Implementation Plan: Fix Student Balance & KPI Accuracy

**Branch**: `002-fix-student-balance` | **Date**: 2026-05-03 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/002-fix-student-balance/spec.md`

## Summary

Two backend bugs cause the Students page to display incorrect balance data and inaccurate KPI cards. (1) The balance formula in the paginated query omits approved ledger adjustments, so the balance column understates or overstates what students owe. (2) KPI statistics are computed from the current paginated page rather than the full tenant population, so every summary card is wrong when more than one page of students exists. The fix is: extend the SQL balance expression to include adjustment subqueries, add a single-query `getGlobalStats()` method that always aggregates across all students, and update the "On Financial Aid" card to show a count.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript + React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL (backend) · TanStack React Query · Axios (frontend)  
**Storage**: MySQL  
**Testing**: Manual verification against known database state; no automated test runner configured  
**Target Platform**: Linux server (backend) · Browser SPA (frontend)  
**Project Type**: Web application — multi-tenant SaaS monorepo (`backend/` + `frontend/`)  
**Performance Goals**: `getGlobalStats()` must complete in < 500 ms for up to 10,000 students per tenant; single SQL round-trip required  
**Constraints**: All queries must be scoped by `tenant_id` from JWT (Constitution I); balance computed at query time, never cached as a column (Constitution V); subquery pattern required for bulk balance queries (Constitution V)  
**Scale/Scope**: Multiple tenants; currently up to several hundred students per tenant

## Constitution Check

*GATE: Must pass before implementation. Re-checked after design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | `getGlobalStats()` includes `tenant_id = ?` in all subqueries; parameter sourced from `$this->getTenantId()` (JWT-decoded) |
| II. API-First Separation | ✅ PASS | No direct DB access from frontend; stats served through existing `/api/students-optimized` endpoint |
| III. JWT Auth & Role-Based Access | ✅ PASS | No new routes; existing endpoint already protected by `JWTAuthFilter` |
| IV. Immutable Migrations | ✅ PASS | No schema changes; no migrations needed |
| V. Financial Ledger Integrity | ✅ PASS | Balance computed at query time via subquery pattern; formula extended to match `getLedgerBalance()` authority |

**Post-design re-check**: All principles hold. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-student-balance/
├── plan.md              # This file
├── research.md          # Phase 0 — root cause analysis and decisions
├── data-model.md        # Phase 1 — entities, balance formula, API shape change
├── quickstart.md        # Phase 1 — verification guide and changed files
├── contracts/
│   └── students-optimized-api.md   # Phase 1 — full API contract with before/after
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/
│   │   └── Api/
│   │       └── StudentsOptimizedController.php   ← replace stats calculation
│   └── Models/
│       └── StudentModel.php                       ← extend balance SQL, add getGlobalStats()

frontend/
├── src/
│   └── pages/
│       └── Students.tsx                           ← update On Financial Aid KPI card
```

**Structure Decision**: Web application (Option 2). Backend and frontend are modified independently; no new files created.

## Implementation Steps

### Step 1 — Update `StudentModel::getFilteredStudents()` balance SELECT

**File**: `backend/app/Models/StudentModel.php`  
**Method**: `getFilteredStudents()` (line 59)

Replace the current two-join balance expression:

```sql
COALESCE(charges.total, 0) - COALESCE(payments.total, 0) as balance
```

With the full four-join expression:

```sql
COALESCE(charges.total, 0) + COALESCE(debits.total, 0)
  - COALESCE(payments.total, 0) - COALESCE(credits.total, 0) AS balance
```

Add two new LEFT JOINs after the existing `payments` join:

```php
->join(
    "(SELECT student_id, SUM(amount) as total FROM ledger_adjustments WHERE tenant_id = {$escapedTenantId} AND adjustment_type = 'debit' AND status = 'approved' GROUP BY student_id) debits",
    'debits.student_id = s.id',
    'left'
)
->join(
    "(SELECT student_id, SUM(amount) as total FROM ledger_adjustments WHERE tenant_id = {$escapedTenantId} AND adjustment_type = 'credit' AND status = 'approved' GROUP BY student_id) credits",
    'credits.student_id = s.id',
    'left'
)
```

The `having('balance >', 0)` clause at line 116 already references the alias, so no further changes needed for the `balanceOnly` filter in this method.

---

### Step 2 — Update `StudentModel::getFilteredStudentsCount()` balanceOnly SQL

**File**: `backend/app/Models/StudentModel.php`  
**Method**: `getFilteredStudentsCount()` (line 146), `$balanceOnly = true` branch

The raw SQL string (lines 154–199) must include two additional LEFT JOIN subqueries for `ledger_adjustments` and use the corrected balance formula in the WHERE clause.

Add after the existing `payments` LEFT JOIN:

```sql
LEFT JOIN (
    SELECT student_id, SUM(amount) as total
    FROM ledger_adjustments
    WHERE tenant_id = ? AND adjustment_type = 'debit' AND status = 'approved'
    GROUP BY student_id
) debits ON debits.student_id = s.id
LEFT JOIN (
    SELECT student_id, SUM(amount) as total
    FROM ledger_adjustments
    WHERE tenant_id = ? AND adjustment_type = 'credit' AND status = 'approved'
    GROUP BY student_id
) credits ON credits.student_id = s.id
```

Add two additional `?` parameters (debit and credit `tenantId`) to `$params` after the existing three. Update the balance filter line from:

```sql
AND (COALESCE(charges.total, 0) - COALESCE(payments.total, 0)) > 0
```

To:

```sql
AND (COALESCE(charges.total, 0) + COALESCE(debits.total, 0) - COALESCE(payments.total, 0) - COALESCE(credits.total, 0)) > 0
```

---

### Step 3 — Add `StudentModel::getGlobalStats()` method

**File**: `backend/app/Models/StudentModel.php`  
**Insert after**: `getFilteredStudentsCount()` method (after line 231)

New public method that returns a single-query aggregate of all KPI values for the entire tenant:

```php
/**
 * Compute tenant-wide student statistics in a single SQL query.
 * Returns counts and sums across ALL students — never paginated.
 * Follows the subquery pattern (Constitution V).
 */
public function getGlobalStats(string $tenantId): array
{
    $db = \Config\Database::connect();
    $escapedTenantId = $db->escape($tenantId);

    $sql = "SELECT
        COUNT(*) AS total_students,
        SUM(CASE WHEN s.status = 'active'      THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN s.status = 'inactive'    THEN 1 ELSE 0 END) AS inactive_count,
        SUM(CASE WHEN s.status = 'graduated'   THEN 1 ELSE 0 END) AS graduated_count,
        SUM(CASE WHEN s.status = 'transferred' THEN 1 ELSE 0 END) AS transferred_count,
        SUM(CASE WHEN s.status = 'dropped_out' THEN 1 ELSE 0 END) AS dropped_out_count,
        SUM(CASE WHEN balance > 0 THEN 1   ELSE 0    END) AS students_with_outstanding_balance,
        SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) AS total_fees_owed,
        SUM(CASE WHEN s.bursary_status != 'none' THEN 1 ELSE 0 END) AS students_on_financial_aid
    FROM (
        SELECT
            s.id,
            s.status,
            s.bursary_status,
            COALESCE(charges.total, 0) + COALESCE(debits.total, 0)
                - COALESCE(payments.total, 0) - COALESCE(credits.total, 0) AS balance
        FROM students s
        LEFT JOIN (
            SELECT student_id, SUM(amount) AS total
            FROM charges
            WHERE tenant_id = {$escapedTenantId}
              AND (is_fee_structure = 1 OR is_transport = 1)
              AND deleted_at IS NULL
            GROUP BY student_id
        ) charges ON charges.student_id = s.id
        LEFT JOIN (
            SELECT student_id, SUM(amount) AS total
            FROM payments
            WHERE tenant_id = {$escapedTenantId}
              AND (is_fee_structure = 1 OR route_id IS NOT NULL)
            GROUP BY student_id
        ) payments ON payments.student_id = s.id
        LEFT JOIN (
            SELECT student_id, SUM(amount) AS total
            FROM ledger_adjustments
            WHERE tenant_id = {$escapedTenantId}
              AND adjustment_type = 'debit' AND status = 'approved'
            GROUP BY student_id
        ) debits ON debits.student_id = s.id
        LEFT JOIN (
            SELECT student_id, SUM(amount) AS total
            FROM ledger_adjustments
            WHERE tenant_id = {$escapedTenantId}
              AND adjustment_type = 'credit' AND status = 'approved'
            GROUP BY student_id
        ) credits ON credits.student_id = s.id
        WHERE s.tenant_id = {$escapedTenantId}
    ) AS s";

    $row = $db->query($sql)->getRowArray();

    $activeCount = (int) ($row['active_count'] ?? 0);
    $studentsOnFinancialAid = (int) ($row['students_on_financial_aid'] ?? 0);

    return [
        'totalStudents'                  => (int)   ($row['total_students'] ?? 0),
        'studentsWithOutstandingBalance' => (int)   ($row['students_with_outstanding_balance'] ?? 0),
        'totalFeesOwed'                  => (float) ($row['total_fees_owed'] ?? 0),
        'studentsOnFinancialAid'         => $studentsOnFinancialAid,
        'bursaryCoveragePercentage'      => $activeCount > 0
            ? round(($studentsOnFinancialAid / $activeCount) * 100, 1)
            : 0,
        'statusCounts' => [
            'active'      => $activeCount,
            'inactive'    => (int) ($row['inactive_count']    ?? 0),
            'graduated'   => (int) ($row['graduated_count']   ?? 0),
            'transferred' => (int) ($row['transferred_count'] ?? 0),
            'dropped_out' => (int) ($row['dropped_out_count'] ?? 0),
        ],
    ];
}
```

---

### Step 4 — Update `StudentsOptimizedController::index()` to use `getGlobalStats()`

**File**: `backend/app/Controllers/Api/StudentsOptimizedController.php`  
**Method**: `index()` (line 23)

Replace line 69:
```php
$stats = $this->calculateStudentStats($formattedStudents);
```

With:
```php
$stats = $this->studentModel->getGlobalStats($tenantId);
```

Remove the private `calculateStudentStats(array $students): array` method entirely (lines 103–145). It is no longer needed.

---

### Step 5 — Update "On Financial Aid" KPI card in `Students.tsx`

**File**: `frontend/src/pages/Students.tsx`  
**Location**: Lines 588–606 (the "On Financial Aid" card)

Replace the current card body:

```tsx
<p className="text-sm font-medium text-muted-foreground">On Financial Aid</p>
<p className="text-2xl font-bold">{stats.bursaryCoveragePercentage}%</p>
<p className="text-xs text-muted-foreground mt-1">
  of active students on bursary
</p>
```

With:

```tsx
<p className="text-sm font-medium text-muted-foreground">On Financial Aid</p>
<p className="text-2xl font-bold">{stats.studentsOnFinancialAid ?? 0}</p>
<p className="text-xs text-muted-foreground mt-1">
  {stats.statusCounts.active > 0
    ? `${stats.bursaryCoveragePercentage}% of active students`
    : "—"}
</p>
```

Also update the `stats` state type initializer at lines 37–49 to add `studentsOnFinancialAid: 0` to the initial state object.

---

## Verification Checklist

After implementation, confirm each item manually:

- [ ] A student with known charges, payments, and approved adjustments shows the correct net balance in the Students table.
- [ ] A student with a soft-deleted charge does NOT have that charge counted in their balance.
- [ ] Navigating from page 1 to page 2 of the student list shows identical KPI card values.
- [ ] The Owing Fees count matches a direct database count of students where their corrected balance > 0.
- [ ] The Total Fees Owed amount matches the database SUM of all positive corrected balances.
- [ ] The On Financial Aid card shows the count of students with `bursary_status != 'none'`, and the sub-text shows the correct percentage.
- [ ] Applying the "balance only" filter updates the table rows but does NOT change the KPI card values.
