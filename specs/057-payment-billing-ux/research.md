# Research: Payment & Billing UX Improvements

**Feature**: `057-payment-billing-ux` | **Branch**: `057-payment-billing-ux`  
**Phase**: 0 — Pre-design research  
**Input**: `spec.md` user stories US1–US5

---

## D1 — Ungenerated Charges Alert: Where to Surface It

**Question**: Should the "ungenerated charges" alert live on the Payments page, the Settings/Fee Rules panel, or both?

**Findings**:
- `useFeeRules.ts` already calls `api.getFeeRuleUnbilledAlert()` which returns `FeeRuleUnbilledAlert { billingPeriod, eligibleStudentCount, unbilledStudentCount }`.
- The hook currently exposes `unbilledAlert` state — it is consumed only inside the Fee Rules Settings panel today.
- The Payments page (`RecordPaymentModal.tsx`, the page that lists payments) has no reference to this alert.
- Transport charges have no parallel "unbilled" API endpoint — the spec targets fee-rule charges only for the alert trigger.

**Decision**: Surface the alert **on the Payments page** as a dismissible banner (Alert component). The existing `useFeeRules` hook and `getFeeRuleUnbilledAlert` endpoint require no backend changes. The frontend Payments page will import `useFeeRules` (or a lightweight `useUnbilledAlert` hook that only calls the alert endpoint) and render the banner when `unbilledStudentCount > 0`. A "Generate Charges" CTA inside the banner navigates the user to the Fee Rules settings tab.

---

## D2 — Multi-Class Fee Rule Scope: Schema Strategy

**Question**: `fee_rules.assignment_scope_id` is `VARCHAR(50)` — a single class ID. The spec requires a fee rule to target multiple classes. What is the least-invasive schema change?

**Options considered**:
1. **JSON array in the same column** — store `["cls_1","cls_2"]` in `assignment_scope_id`. No migration required. Downside: breaks indexed look-up and violates relational normalisation; `getEligibleStudents` must JSON-decode the value.
2. **Widen to TEXT, store comma-separated IDs** — similar trade-offs to option 1 but slightly simpler parsing.
3. **New join table `fee_rule_class_assignments(fee_rule_id, class_id)`** — fully normalised; the existing single-scope column becomes `NULL` for class-type rules. Clean but requires a migration and a new model.
4. **Store JSON in a new `assignment_scope_ids` column (TEXT NULL)** — additive column; old single-class rules keep `assignment_scope_id` for backwards compat; new multi-class rules use `assignment_scope_ids`. Adds ambiguity.

**Decision**: **Option 1 — JSON array stored in the existing `assignment_scope_id` column** (widened to `TEXT` by migration). Rationale:
- The column is not indexed on its value today (the index is on `tenant_id + is_active`, not on `assignment_scope_id`).
- All reads of the column go through `FeeRuleModel::formatForApi()` and `FeeRuleBillingService::getEligibleStudents()` — there are exactly two callsites to update.
- The frontend already treats `assignmentScopeId` as `string | null` in `api.ts`; change to `string | string[] | null` (union) — multi-class rules send an array, single-class rules remain a string for backward-compat.
- A full normalised join table is warranted only if queries need to filter rules *by* class — that is not a current requirement.
- Migration: add `ALTER TABLE fee_rules MODIFY assignment_scope_id TEXT NULL` (idempotent guard).

**Impact**: `FeeRuleBillingService::getEligibleStudents` adds a branch: when `$scopeId` is a JSON array (i.e. `json_decode` returns an array), use `whereIn('class_id', $classIds)` instead of `where('class_id', $scopeId)`.

---

## D3 — Payment Category Semantics: System vs. User-Defined

**Question**: Payment categories are currently stored in `tenants.settings.payment_categories` as user-managed JSON. The spec introduces hard-coded system categories with charge-reduction semantics. How do we reconcile these?

**Findings**:
- `TRANSPORT_CATEGORIES` in `RecordPaymentModal.tsx` already hard-codes `__transport` and `__transport_fees` with synthetic IDs. These are prepended client-side and are never persisted to the settings store.
- The system needs a third system category: **Fees** (currently the backend defaults `category = 'Fees'` when none is supplied in `PaymentController::create()`).
- `LedgerService::allocatePaymentToCharges()` uses `route_id IS NULL` to identify fee-structure payments and `route_id IS NOT NULL` for transport payments — it does **not** use the `category` column for allocation routing.

**Decision**: The `category` column on the `payments` table remains a **bookkeeping tag only**. The charge-reduction (FIFO allocation) routing continues to be determined by `route_id` presence, not by category name. The three system categories are defined as a **backend constant** (PHP + TS) and are treated as non-deletable from the UI. The frontend marks them visually (e.g. badge colour, lock icon) and prevents editing/deletion. No new migration is needed for this user story; the semantics are enforced by UI guards and backend validation (reject delete/rename of system category names: `Transport`, `Fees`, `Transport + Fees`).

**System category definitions**:

| Name | Synthetic ID | Charge-reduction scope |
|---|---|---|
| Fees | `__fees` | Fee-structure charges (`route_id IS NULL`) |
| Transport | `__transport` | Transport charges (`route_id IS NOT NULL`) |
| Transport + Fees | `__transport_fees` | Both pools |

The `__fees` system category is **new** (was implicit before). All three are injected by the backend `getPaymentCategories` response so the frontend does not need to hard-code IDs.

---

## D4 — Receipt Number Format

**Question**: The spec requires `YYYY.MM.DD.HHmmss.X` format where X is a random letter. Where is the receipt number generated and stored?

**Findings**:
- The `payments` table has no `receipt_number` column today.
- `ReceiptController::show()` uses the payment `id` (e.g. `p1746300123_abc12345`) as the receipt identifier for URL routing (`GET /api/receipts/:id`).
- `PaymentController::create()` generates the payment `id` via `generateId('p')` = `p{unix_timestamp}_{8 hex chars}`.

**Decision**: Add a `receipt_number` column to the `payments` table. It is generated server-side in `PaymentController::create()` immediately before insert, using the format `YYYY.MM.DD.HHmmss.X` where X is a random uppercase letter (A–Z). This is exposed in `formatForApi()` and returned to the client on payment creation and in the receipt response. The column is `VARCHAR(25) NULL` to support legacy rows that predate this feature (receipts for old payments display the payment ID as a fallback).

**Format generation** (PHP):
```php
$receiptNumber = date('Y.m.d.His') . '.' . chr(random_int(65, 90));
```

---

## D5 — Payment Snapshot: What Fields, Where Stored

**Question**: The spec requires storing a snapshot of student/class data at payment time. `balance_after_payment` already exists on `payments`. What additional fields must be snapshotted and how?

**Findings**:
- `payments` table currently stores: `id`, `tenant_id`, `student_id`, `amount`, `date`, `method`, `description`, `category`, `route_id`, `balance_after_payment`, `created_at`, `updated_at`.
- `ReceiptController::show()` performs a live JOIN to `students` and `classes` to get `class_name` — this is **not** snapshotted today.
- The spec acceptance scenario explicitly tests: if a class is renamed after a payment, the receipt still shows the original class name.

**Decision**: Add a `snapshot` column (`JSON NULL`) to the `payments` table. Populated at payment creation time with:
```json
{
  "studentName": "Alice Moyo",
  "className":   "Form 3A",
  "balanceBefore": 120.00,
  "paymentMethod": "Cash",
  "paymentDate":  "2026-05-04",
  "amount":       80.00,
  "category":     "Fees"
}
```
`ReceiptController::show()` reads `snapshot.className` in preference to the live JOIN result when the snapshot is present. For legacy payments without a snapshot, the live JOIN fallback is preserved. `PaymentController::create()` populates the snapshot inside the same transaction that inserts the payment and snapshots `balance_after_payment`.

---

## D6 — Fee Rule Scope Column: Display Class Name Not ID

**Question**: `FeeRulesPanel.tsx` displays the scope column. `FeeRuleModel::buildScopeLabel()` returns `"Class: {class_id}"` — the raw ID. How do we show the class name?

**Findings**:
- `FeeRuleModel::formatForApi()` produces `assignmentScopeLabel` today as `"Class: cls_abc123"`.
- The backend does not JOIN to `classes` when fetching fee rules because `classes` is tenant-scoped and the model uses a simple `findAll()`.
- The frontend has access to the full class list via `api.getClasses()` / the `classes` query cache.

**Decision**: **Frontend resolution** — the simplest, zero-migration fix. `FeeRulesPanel.tsx` already receives the class list (or can call `useClasses` hook). When rendering the scope column for `class`-type rules, resolve the class name from the local class list using `assignmentScopeId`. The backend `buildScopeLabel` is updated to return `"class:{scopeId}"` as a machine-readable prefix so the frontend knows it holds an ID, not a label. For multi-class rules (D2), the label becomes a comma-joined list of resolved class names.

---

## D7 — LedgerService Category-Routing: Impact of New Payment Categories

**Question**: The spec says system categories determine which charges are reduced. Currently routing is by `route_id`. Does adding `__fees` change allocation logic?

**Decision**: **No change to allocation routing** in this feature. `LedgerService::allocatePaymentToCharges()` continues to route by `route_id`. The category is purely a bookkeeping tag. The spec statement "Transport category should reduce only transport charges" is an existing behaviour (all transport payments already carry a `route_id`); the system category semantics document and formalise this. No migration or service change required for allocation.

---

## Summary of Resolved Decisions

| # | Decision | Backend change | Frontend change | Migration |
|---|---|---|---|---|
| D1 | Alert on Payments page | None | New banner + CTA | None |
| D2 | Multi-class: JSON in `assignment_scope_id` | `FeeRuleModel`, `FeeRuleBillingService`, `FeeRuleController` | `FeeRuleModal` multi-select, `api.ts` type | Widen column to TEXT |
| D3 | System categories as constants | Backend constant + guard on delete | Visual badges, lock icon | None |
| D4 | Receipt number: `YYYY.MM.DD.HHmmss.X` | `PaymentController`, `formatForApi` | Display on receipt/payment list | New `receipt_number VARCHAR(25) NULL` |
| D5 | Snapshot JSON on payment | `PaymentController`, `ReceiptController` | Display snapshot fields | New `snapshot JSON NULL` |
| D6 | Class name in scope column | `buildScopeLabel` prefix fix | Frontend name resolution | None |
| D7 | Category routing unchanged | None | None | None |
