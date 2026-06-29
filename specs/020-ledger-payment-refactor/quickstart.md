# Quickstart: Ledger and Payment System Refactor

**Branch**: `020-ledger-payment-refactor`
**For**: Developers implementing this feature

---

## What This Refactor Touches

| Area | Files Changed | Type |
|------|--------------|------|
| Backend controllers | LedgerController, PaymentController, ReconciliationController | Modify |
| New backend service | LedgerService | New file |
| Backend models | ChargeModel, PaymentModel | Modify |
| Database migrations | 6 new migration files | New files |
| Backend routes | Routes.php | Modify (new report routes) |
| Frontend API layer | api.ts | Modify (new report endpoints) |
| Frontend pages | Payments.tsx, possibly Settings | Modify |
| Frontend hooks | useChargeGeneration.ts, useStudentBalance.ts | Modify |

---

## Environment Setup

```bash
# Backend
cd backend
composer install
php spark migrate        # Apply all new migrations
php spark db:seed SampleDataSeeder  # Load fresh test data

# Frontend
cd frontend
npm install
npm run dev              # Starts on port 8080
```

Default credentials: `admin@greenwood.co.zw` / `1234`

---

## Implementing the Changes — Recommended Order

### Step 1: Database Migrations (do first)

Run migrations before changing any code. Each migration is independent:

```bash
cd backend
php spark migrate
```

New migrations (in order):
1. `2026-04-08-000001_Backfill_charge_type_from_flags` — populates `charge_type` from legacy boolean flags
2. `2026-04-08-000002_Add_charge_type_indexes` — adds index on `(tenant_id, charge_type, status)`
3. `2026-04-08-000003_Add_adjustment_indexes` — adds indexes on `ledger_adjustments`
4. `2026-04-08-000004_Add_billing_run_status_index` — adds index on `(tenant_id, status)`
5. `2026-04-08-000005_Add_payment_date_index` — adds `(tenant_id, date DESC)` on `payments`
6. `2026-04-08-000006_Add_billing_run_unique_constraint` — unique constraint on billing_runs

---

### Step 2: Create LedgerService

**File**: `backend/app/Services/LedgerService.php`

This is the most important new file. All balance calculation routes through here.

Key methods to implement:
- `getStudentBalance(studentId, tenantId): array` — replace both existing implementations
- `getAllBalances(tenantId): array` — preserve the subquery optimization (Constitution Principle V)
- `allocatePaymentToCharges(studentId, tenantId, db): void` — extracted from PaymentController
- `isBillingRunVoidable(billingRunId, tenantId): bool` — check for payments before void
- `getAgedBalances(tenantId, termId): array` — new for reports
- `getPaymentCollectionReport(tenantId, termId): array` — new for reports

---

### Step 3: Update ChargeModel

Remove backward-compatibility code in `formatForApi()`. Stop deriving `isFeeStructure`/`isTransport` from booleans — read from `charge_type` directly.

Update all queries that filter on `is_fee_structure` or `is_transport` to use `charge_type` instead:
- `getTransportChargesByStudent()` → WHERE `charge_type = 'transport'`
- Any pending charge queries → include `charge_type` in WHERE as needed

---

### Step 4: Update PaymentController

In `updateChargeStatuses()` (now moved to LedgerService as `allocatePaymentToCharges()`):
- Replace `WHERE is_fee_structure = 1` with `WHERE charge_type = 'fee_structure'`
- Replace payment filter `is_fee_structure = 1` with `route_id IS NULL` (fee-structure payments have no route)

In `termTotal()`:
- Replace hardcoded month-based term detection with academic calendar lookup from tenants table
- Accept optional `termId` query parameter

---

### Step 5: Implement Billing Run Methods in LedgerController

Add/complete these methods (routes already exist):
- `getBillingPreview()` — read-only calculation, no DB writes
- `getBillingStatus()` — query billing_runs table
- `finalizeBilling()` — full billing run: create billing_runs record + generate charges atomically
- `voidBilling()` — soft-delete charges + update billing_runs.status using LedgerService::isBillingRunVoidable()
- `getUnbilledStudents()` — students without charges in term
- `generateSupplementaryBilling()` — like finalizeBilling but for a subset of students

---

### Step 6: Add Report Endpoints

Add new controller method for each report or create `ReportController`:
- `GET /api/reports/payment-collection` → LedgerService::getPaymentCollectionReport()
- `GET /api/reports/aged-balances` → LedgerService::getAgedBalances()
- `GET /api/reports/revenue-by-category` → new SQL query comparing charges vs. payments by category

Register in `Routes.php` under `/api/reports/*` with role guard (`bursar`, `admin`, `super_admin`).

---

### Step 7: Update ReconciliationController

Replace `calculateStudentBalance()` private method with a call to `LedgerService::getStudentBalance()`. Verify the formula produces identical results before removing the old implementation.

---

### Step 8: Update Frontend API Layer

In `frontend/src/api/api.ts`, add:
```typescript
getPaymentCollectionReport: (termId: string) => api.get(`/reports/payment-collection?termId=${termId}`)
getAgedBalances: (termId: string) => api.get(`/reports/aged-balances?termId=${termId}`)
getRevenueByCategoryReport: (termId: string, category?: string) => api.get(...)
```

Update existing calls where needed (e.g., balance response now has `feeBalance` and `transportBalance`).

---

### Step 9: Update Frontend Hooks

`useStudentBalance.ts` — update the `StudentBalance` interface to include `feeBalance` and `transportBalance`:
```typescript
interface StudentBalance {
  studentId: string;
  totalCharges: number;
  totalPayments: number;
  creditAdjustments: number;
  debitAdjustments: number;
  balance: number;
  feeBalance: number;      // NEW
  transportBalance: number; // NEW
}
```

`useChargeGeneration.ts` — update `generateCharges()` to use the billing finalize flow instead of direct charge generation if a billing run exists.

---

## Testing Approach

### Backend Tests (manual via Postman/curl)

1. **Charge Type Migration**: After migration 1, verify `SELECT COUNT(*) FROM charges WHERE charge_type IS NULL` returns 0.
2. **Balance Consistency**: For 10 students, compare balance from `LedgerController::getStudentBalance()` and `ReconciliationController::getStudentBalanceDetail()` — must be identical.
3. **Payment FIFO**: Record a payment for a student with 3 pending charges — verify oldest charge transitions to `paid` first.
4. **Billing Run Idempotency**: Call `POST /billing/finalize` twice for the same term — second call must return 409.
5. **Billing Run Void Safety**: Attempt to void a billing run after recording a payment — must return error.
6. **Report Accuracy**: Cross-check `GET /reports/payment-collection` totals against manual SUM queries on charges and payments tables.

### Frontend Tests (manual)

1. Record a payment and verify balance updates without page refresh.
2. Generate charges for a term, verify billing run appears in history, undo it.
3. Apply a credit adjustment and verify balance decreases.
4. View payment collection report — verify totals match.

---

## Common Gotchas

- **Always filter by `tenant_id`** in every new query (Constitution Principle I) — use `$tenantId` from `$this->jwtPayload->tenant_id`, never from request body.
- **Transactions**: All charge generation, payment recording, and adjustment creation must use database transactions with rollback on failure.
- **LedgerService is not a CodeIgniter Model** — instantiate it with `new LedgerService()` and pass `$db` where needed, or use CI4's service layer if preferred.
- **The `billing_runs` unique constraint is application-level** — check for existing non-voided run BEFORE inserting to return a clean 409 error rather than a raw DB constraint error.
- **Do not call `updateChargeStatuses()` directly** after moving it to `LedgerService` — the old method name in PaymentController should call the service method.
