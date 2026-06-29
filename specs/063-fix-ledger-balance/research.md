# Research: Fix Ledger Balance Filtering

## Decision 1: Approved ledger scope is an explicit allowlist

**Decision**: Define the eligible balance scope with exact server-side allowlists:

- Charge types: `fee_structure`, `transport`
- Payment categories: `Fees`, `Transport + Fees`, `Transport Fee`

**Rationale**: The feature request explicitly says the student balance must use only these charge types and payment categories. A named allowlist prevents unrelated general payments, campaigns, user-defined categories, and accidental route-based classifications from changing the official student balance.

**Alternatives considered**:

- Continue using `route_id` and `is_general_payment` as payment eligibility signals — rejected because the requirement is category-based and specific.
- Include all system payment categories — rejected because the requirement names only three eligible categories.
- Include similar category names such as `Transport` — rejected for the balance formula because the requested approved category is `Transport Fee`.

## Decision 2: `LedgerService` remains the authoritative balance source

**Decision**: Centralize eligibility helpers/constants in the backend ledger layer and use them in `LedgerService::getStudentBalance()`, `LedgerService::getAllBalances()`, and `LedgerService::allocatePaymentToCharges()` where payment eligibility affects ledger state.

**Rationale**: `LedgerService` is already documented as the single authoritative balance service and is used by ledger, student balance, payment snapshot, and reconciliation paths. Centralizing the filters avoids inconsistent calculations between endpoints.

**Alternatives considered**:

- Update each controller independently — rejected because it duplicates business rules and risks future drift.
- Move balance calculation to the frontend — rejected because the API is the boundary and ledger rules must remain backend-owned.

## Decision 3: Student-list balance SQL must be aligned or delegated

**Decision**: Align remaining `StudentModel` balance paths with the same eligibility rules or delegate them to a reusable SQL fragment/helper that applies the same charge/payment filters.

Relevant paths found:

- `StudentModel::getFilteredStudents()`
- `StudentModel::getFilteredStudentsCount()` when `balanceOnly=true`
- `StudentModel::getGlobalStats()`
- `StudentModel::preloadLedgerBalancesForIds()`
- `StudentModel::getLedgerBalance()`
- `StudentModel::preloadLedgerBalances()`

**Rationale**: The current code has separate balance SQL paths. Some already filter charge types, but payments are often summed broadly. If these paths are not aligned, student tables, KPIs, and detailed ledger endpoints can show different balances for the same student.

**Alternatives considered**:

- Use only `LedgerService::getStudentBalance()` in loops — rejected for list pages because it would introduce N+1 queries.
- Store a computed balance column — rejected by the constitution because balances must be computed from source records.

## Decision 4: Opening balance is represented by eligible charges

**Decision**: Treat opening balance as part of Total Charges when it is stored as a charge with `charge_type = 'fee_structure'` and `is_opening_balance = 1`.

**Rationale**: Existing student creation/opening-balance logic creates opening balance rows in `charges` with `charge_type = 'fee_structure'`. This means the formula component `Opening Balance` is already covered by the approved charge-type filter without needing a separate storage mechanism.

**Alternatives considered**:

- Add a separate opening balance table/field — rejected because existing data already models opening balance as a charge and no schema change is needed.
- Count opening balances regardless of charge type — rejected because the requirement says all formula components must be filtered to the specified ledger scope.

## Decision 5: Approved adjustments remain included by student and tenant

**Decision**: Include only approved ledger adjustments for the selected student and tenant: debit adjustments increase balance; credit adjustments reduce balance.

**Rationale**: Existing `ledger_adjustments` records have `adjustment_type` and `status`. There is no separate charge-type or payment-category field on adjustments in the current model. Because the specification requires Debit Adjustments and Credit Adjustments in the formula, approved student-scoped adjustments remain eligible.

**Alternatives considered**:

- Exclude all adjustments — rejected because the required formula explicitly includes them.
- Add adjustment category fields — rejected for planning because current requirements can be satisfied without schema change and existing adjustments are already student-scoped.

## Decision 6: No new API endpoint is required

**Decision**: Preserve existing balance endpoints and response envelopes while changing the calculation semantics behind them.

Affected endpoints:

- `GET /api/students/:id/balance`
- `GET /api/ledger/student/:id/balance`
- `GET /api/ledger/balances`
- `GET /api/reconciliation/student/:id/balance`
- `POST /api/reconciliation/recalculate-balance`
- Student list endpoints that include `balance` fields and balance-based KPIs

**Rationale**: The user requested corrected calculation behavior, not a new workflow. Keeping endpoints stable minimizes client changes and preserves API compatibility.

**Alternatives considered**:

- Create a new filtered-balance endpoint — rejected because it would leave old endpoints inconsistent and confuse consumers.

## Summary Decision Table

| Topic | Decision |
|-------|----------|
| Charge eligibility | Exact `charge_type IN ('fee_structure', 'transport')` |
| Payment eligibility | Exact `category IN ('Fees', 'Transport + Fees', 'Transport Fee')` |
| Opening balance | Included only through eligible charge records |
| Adjustments | Approved student-scoped debit/credit adjustments included |
| Authority | Centralize in backend ledger layer; align all balance SQL paths |
| API shape | Existing endpoints retained; semantics corrected |
| Migrations | None planned |
