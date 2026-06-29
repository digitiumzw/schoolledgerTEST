# Research: Fee Structure Billing Cycle Configuration

**Branch**: `047-fee-billing-cycle` | **Date**: 2026-04-27  
**Status**: Complete — all NEEDS CLARIFICATION items resolved

---

## Research Item 1: Where is `structureType` currently stored and does it need a schema change?

**Decision**: No schema change required. `structureType` already exists as a key inside the `fee_structure` JSON column on the `tenants` table. The field is already read in `SettingsController::getFeeStructure()` and written in `SettingsController::saveFeeStructure()`. The backend already defaults it to `'termly'`. The frontend `FeeStructure` TypeScript interface already types it as `'termly' | 'monthly' | 'custom'`. Only the charge generation path in `LedgerController::finalizeBilling()` is missing the logic to act on this value.

**Rationale**: Adding a schema column would require a migration, add coupling, and provide no benefit since the field is already reliably persisted in the JSON blob. The constitution (Principle IV) prefers avoiding unnecessary migrations.

**Alternatives considered**: Adding a dedicated `billing_cycle` column to `tenants` — rejected because the data is already in `fee_structure` JSON, and duplicating it would create a source-of-truth conflict.

---

## Research Item 2: How should the number of monthly installments be calculated from term dates?

**Decision**: Count the number of distinct calendar months that overlap with the term's `start`–`end` date range, using ceiling division. A term that starts 2026-01-15 and ends 2026-03-31 spans January, February, and March → 3 installments. A single-month term (start and end in the same calendar month) → 1 installment.

**Algorithm**:
```
months = (end_year * 12 + end_month) - (start_year * 12 + start_month) + 1
```
This is pure integer arithmetic, always produces a whole number ≥ 1, and handles year boundaries correctly.

**Rationale**: Counting distinct months is simpler, more predictable, and more aligned with how schools communicate billing ("pay in January, February, March") than dividing the day count by 30 or 30.44, which produces non-integer results. The spec (FR-006) specifies "rounding up to the nearest whole month", and this algorithm naturally satisfies that without a separate ceiling operation.

**Alternatives considered**:
- Day-count ÷ 30 with `ceil()`: produces inconsistent results (a 29-day month would give ceil(29/30) = 1, a 31-day month gives ceil(31/30) = 2). Rejected.
- Day-count ÷ 30.44 average: produces fractional results, not school-friendly. Rejected.

---

## Research Item 3: How should installment amounts be distributed to avoid rounding loss?

**Decision**: Banker's rounding is not used; instead, distribute using the "last installment absorbs remainder" rule:
```
base_amount = floor(term_fee * 100 / months) / 100       // truncate to cent
last_amount = term_fee - (base_amount * (months - 1))    // absorbs any remainder
```
This guarantees `SUM(installments) == term_fee` exactly, with at most a 1-cent difference on the last installment.

**Rationale**: Schools verify totals on reports and expect the sum of all installments to equal the configured term fee. This approach is deterministic (no float comparison surprises) and trivially auditable — the last installment is always clearly the "balancing" entry.

**Alternatives considered**:
- `round(term_fee / months, 2)` applied to all installments: produces a rounding error that accumulates (e.g., $100 / 3 = $33.33 × 3 = $99.99). Rejected.
- Proportional distribution with `bcmath`: correct but adds a PHP extension dependency that may not be enabled. The truncation approach achieves the same correctness with native arithmetic. Rejected.

**Bursary application order**: Bursary discount is applied first to the full term fee amount for the fee category, then the discounted total is split into installments. This matches the spec (FR-009) and is consistent with how `finalizeBilling` currently computes `$amount = $feeAmount * $bursaryMultiplier`.

---

## Research Item 4: What due date and description should each monthly installment carry?

**Decision**:
- **Due date**: 1st day of the installment's calendar month. For the first installment, if the term starts after the 1st, still use the 1st of that month (the school is setting a billing expectation, not a late-payment date tied to the term start). This simplifies reporting and is consistent with standard monthly billing.
- **Description format**: `"{FeeName} – {MonthName} {Year}"` — e.g., `"Tuition – January 2026"`. The `term` field on the charge still carries the term name (e.g., `"Term 1"`) for backward compatibility with existing reports.

**Rationale**: Monthly billing in schools is understood as "pay by the 1st of the month". Using the 1st avoids confusion about whether it's the term start date or a fixed date. The description format satisfies FR-007 and makes aging reports immediately readable.

**Alternatives considered**:
- Due date = term start date for first installment, term start + 30 days for second, etc.: produces irregular due dates that don't align with calendar months. Rejected.
- Description without year: ambiguous across academic years. Rejected.

---

## Research Item 5: Does the billing preview endpoint need changes, and how?

**Decision**: `LedgerController::getBillingPreview()` response is extended with three new fields:
- `billingCycle`: `"termly"` or `"monthly"` (read from `$feeStructure['structureType']`)
- `installments`: integer count (1 for termly, N for monthly)
- `installmentAmount`: per-installment amount for a default-fee student (useful for the preview display)

These fields are additive — existing frontend consumers of `/api/billing/preview` are unaffected by new keys.

**Rationale**: FR-008 requires the preview to show the billing cycle and installment breakdown. Extending the existing preview endpoint is the least-disruptive approach (Principle II, Principle VI).

---

## Research Item 6: Does the duplicate-prevention guard (idempotency check) work correctly under monthly billing?

**Decision**: Yes, unchanged. The existing check in `finalizeBilling()` queries `billing_runs` for a `completed` run with the same `tenant_id` and `term_id`. Under monthly billing, the same `billing_runs` record is created once per term — the monthly charge rows all share the same `billing_run_id`. Attempting to generate again for the same term hits the same guard. No changes required.

**Rationale**: The guard is keyed on term, not on individual charge rows, so it is billing-cycle-agnostic. FR-010 is satisfied without any modification.

---

## Research Item 7: Does the `SettingsController::saveFeeStructure()` validation need updating?

**Decision**: Yes, a minimal change. The current validation in `saveFeeStructure()` accepts `['termly', 'monthly', 'annual']`. `annual` is out of scope per the spec assumptions. The validation should be tightened to `['termly', 'monthly']` only, to prevent an unsupported cycle from silently being stored and then causing undefined behaviour at generation time. This is a one-line change to the `$validStructureTypes` array.

**Rationale**: Defensive security (Principle VIII) — reject inputs the system cannot honour. The spec explicitly de-scopes `annual`.

---

## Research Item 8: How does the existing `ChargeGenerationPanel` preview modal need to change?

**Decision**: The modal already receives `structure` as a prop. The `billingCycle` and `installments` fields from the updated preview API response are passed through `useChargeGeneration` → `BillingTab` → `ChargeGenerationPanel`. The panel renders a new informational line: "Billing cycle: Monthly (3 installments)" or "Billing cycle: Termly" before the fee breakdown table. No new hooks or components are needed — only a UI addition inside the existing panel.

**Rationale**: Keeps changes minimal (Principle VII) and does not require a new component or hook extraction.

---

## Summary of Decisions

| Item | Decision |
|------|----------|
| Storage | Use existing `structureType` key in `fee_structure` JSON — no migration |
| Installment count | Distinct calendar months overlapping term dates (integer, ≥ 1) |
| Rounding | Truncate to cent for first N-1 installments; last absorbs remainder |
| Bursary order | Apply bursary to full term fee, then split result into installments |
| Due dates | 1st of each calendar month within the term |
| Descriptions | `"{FeeName} – {MonthName} {Year}"` |
| Preview API | Extend with `billingCycle`, `installments`, `installmentAmount` fields |
| Duplicate guard | Unchanged — term-keyed guard works for both cycles |
| Validation | Tighten `saveFeeStructure` to `['termly', 'monthly']` (remove `annual`) |
| UI | Billing cycle selector in `FeeStructureTab`; cycle label in `ChargeGenerationPanel` |
