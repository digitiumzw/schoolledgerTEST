# Research: Ledger and Payment System Refactor

**Branch**: `020-ledger-payment-refactor`
**Phase**: 0 — Research
**Date**: 2026-04-08

---

## Decision 1: Charge-Payment Linkage Strategy

**Unknown**: The system uses stateless FIFO re-allocation (charges are not directly linked to payments). Should we add a junction table or a `charge_id` FK on payments to create explicit allocation records?

**Decision**: Retain stateless FIFO re-allocation for now. Add a `payment_charge_allocations` junction table as a Phase 3 enhancement (out of scope for this refactor).

**Rationale**:
- Adding `charge_id` to payments is a breaking schema change requiring migration of all existing payment records.
- FIFO re-allocation is deterministic and correct when payment/charge dates are consistent.
- A junction table is the right long-term solution but introduces significant scope creep.
- The immediate priority is making the existing allocation logic consistent and reliable.

**Alternatives considered**:
- Add `charge_id` FK to payments directly — rejected (breaking change, scope too large).
- Store allocation ledger entries on each payment — rejected (duplicates FIFO logic, adds write complexity).

---

## Decision 2: Charge Type Classification — Legacy Field Retirement

**Unknown**: Both `is_fee_structure`/`is_transport` boolean flags AND `charge_type` ENUM exist in the charges table. Which should be authoritative, and how do we retire the legacy fields?

**Decision**: `charge_type` ENUM is the single authoritative field going forward. Retire the boolean flags in two phases:

- **Phase A (this refactor)**: Add migration to backfill `charge_type` for any rows where it is NULL. Update ALL queries (LedgerController, ChargeModel, PaymentController) to use `charge_type` exclusively. Remove backward-compatibility code from `ChargeModel::formatForApi()`.
- **Phase B (follow-up migration)**: Drop `is_fee_structure` and `is_transport` columns after verifying no queries reference them.

**Rationale**:
- The dual-field system creates confusion and allows divergent state (e.g., `is_fee_structure=1` but `charge_type='transport'`).
- ENUM is more expressive and extensible (can add `other` types without schema change).
- Phase A/B separation allows safe rollout: Phase A queries work regardless of whether booleans are present.

**Alternatives considered**:
- Keep booleans, remove ENUM — rejected (less expressive, harder to extend).
- Dual-field approach permanently — rejected (documented as a known issue in the spec).

---

## Decision 3: Balance Formula — Canonical Source of Truth

**Unknown**: `LedgerController::getStudentBalance()` and `ReconciliationController::calculateStudentBalance()` both implement balance calculation. Are they identical? Which is authoritative?

**Decision**: Extract balance calculation into a single shared method in a new `LedgerService` class. Both controllers delegate to it. The formula is:

```
balance = SUM(active_charges) + SUM(approved_debit_adjustments) - SUM(payments) - SUM(approved_credit_adjustments)
```

Where "active" means: `deleted_at IS NULL AND voided_at IS NULL`.

**Rationale**:
- Two implementations means two potential sources of divergence. A single service method eliminates this.
- The formula is confirmed correct by cross-referencing both existing implementations (they agree).
- `LedgerService` keeps ledger logic out of HTTP controllers (better separation).

**Constitution alignment**: Constitution Principle V requires balance to be derived at query time from source records. This decision is fully compliant.

**Alternatives considered**:
- Store balance in students table — rejected (violates Constitution Principle V).
- Keep two implementations — rejected (divergence risk, spec FR-021 requires single authoritative formula).

---

## Decision 4: Billing Run Implementation Gap

**Unknown**: Six billing-run endpoints exist in Routes.php (`/billing/preview`, `/billing/status`, `/billing/finalize`, `/billing/void`, `/billing/unbilled-students`, `/billing/supplementary`) but the `getBillingPreview`, `finalizeBilling`, `voidBilling` methods in LedgerController appear incomplete or stub-level. What is the intended billing workflow?

**Decision**: Implement the full billing run lifecycle:

1. `GET /billing/preview` — calculate what charges would be generated; return per-student, per-category breakdown. No DB writes.
2. `GET /billing/status` — return status of billing run for a term (none / pending / completed / voided).
3. `POST /billing/finalize` — create the `billing_runs` record, generate all charges, link `billing_run_id`. Idempotent if called twice for the same term.
4. `POST /billing/void` — soft-void a billing run if no payments exist against its charges.
5. `GET /billing/unbilled-students` — return students without charges in the selected term.
6. `POST /billing/supplementary` — generate charges for a subset of students (catch-up billing).

**Rationale**:
- The `billing_runs` table schema and `billing_run_id` on charges already anticipate this workflow.
- Separating preview from finalize prevents accidental charge generation.
- Idempotency on finalize prevents duplicate billing runs for the same term.

**Alternatives considered**:
- Keep existing `POST /charges/generate` as the only charge generation path — rejected (doesn't use billing_runs table, loses auditability).

---

## Decision 5: Term Tracking — Hardcoded Logic vs. Academic Calendar

**Unknown**: `PaymentController::termTotal()` uses hardcoded month-based term detection (month ≤ 6 = Term 1). The academic calendar is stored in the tenants table. Which should be used?

**Decision**: Replace hardcoded term detection with a lookup against the `academic_calendar` stored on the tenant record. The `term-total` endpoint should accept an explicit `termId` parameter with fallback to current-term detection via calendar.

**Rationale**:
- Hardcoded month-based detection breaks for schools on non-standard academic calendars.
- The academic calendar already exists in the tenants table and is the system's authoritative source.
- Explicit `termId` parameter aligns with how other endpoints work.

**Alternatives considered**:
- Deprecate `term-total` endpoint — rejected (frontend uses it for dashboard stats).

---

## Decision 6: Payment Report Endpoints — New vs. Extend Existing

**Unknown**: No aged balance report or payment collection rate report exists. Should we add new endpoints or extend existing ones?

**Decision**: Add three new report endpoints to LedgerController:

1. `GET /api/reports/payment-collection?termId=X` — total charged, collected, collection rate %, per-student breakdown
2. `GET /api/reports/aged-balances?termId=X` — students grouped by days-overdue buckets (current / 1-30 / 31-60 / 61-90 / 90+)
3. `GET /api/reports/revenue-by-category?termId=X&category=Y` — charged vs. collected per category

Route group: `/api/reports/*` — restricted to `bursar`, `admin`, `super_admin` roles.

**Rationale**:
- New route group avoids polluting existing endpoint namespaces.
- Report queries are read-only; they can be implemented as optimized SQL without touching write paths.
- The existing `GET /payments/revenue-by-category` endpoint is payment-only; the new version compares charges vs. payments.

**Alternatives considered**:
- Add report parameters to existing endpoints — rejected (report queries are significantly different from list queries; mixing would complicate both).

---

## Decision 7: Concurrent Billing Run Protection

**Unknown**: What mechanism prevents two bursars triggering charge generation simultaneously for the same term?

**Decision**: Use a database-level unique constraint on `billing_runs(tenant_id, term_id, status)` where status is not 'voided'. Check for existing non-voided billing run before inserting; return 409 Conflict if one exists.

**Rationale**:
- Application-level locking is unreliable under race conditions.
- A unique constraint enforced at the database level guarantees at most one active billing run per term per tenant.
- Returns a clear error message to the second requester.

**Alternatives considered**:
- Redis/file-based locking — rejected (introduces external dependency not present in the stack).
- Optimistic locking — rejected (more complex, not needed at this scale).

---

## Decision 8: `month` Field on Payments

**Unknown**: The `payments.month` column stores a value derived from `payments.date`. Is it still written to the database?

**Finding**: `PaymentModel::formatFromApi()` does NOT write a `month` field. The `month` field in `formatForApi()` is derived at read-time from `date`. The column does not actually exist in the DB schema (confirmed: it's not in any migration). It is a virtual field in the API response only.

**Decision**: No action required on the database. Ensure the virtual `month` field derivation in `formatForApi()` is consistent (use `date('n', strtotime($date))` everywhere). Document this as a computed field in the API contract.

---

## Decision 9: Role Enforcement for New Report Endpoints

**Decision**: New `/api/reports/*` endpoints require `bursar`, `admin`, or `super_admin` role. Teacher role is read-only on student balance; teachers cannot access financial reports.

**Rationale**: Aligns with existing role structure. Financial aggregate reports are sensitive; teachers should not see school-wide revenue data.

---

## Known Limitations (Out of Scope)

1. **Charge-Payment Junction Table** — Explicit tracking of which payment satisfied which charge is deferred to a future sprint. FIFO re-allocation remains the mechanism.
2. **Adjustment Approval Workflow** — Adjustments currently auto-approve. A multi-step approval flow (bursar creates → admin approves) is a future feature. Current behavior (auto-approve) is retained.
3. **Report Export (CSV/PDF)** — In-app display only. Export is out of scope per spec Assumptions.
4. **Stored Balance Cache** — Constitution Principle V prohibits a stored balance column. No caching is introduced.
5. **Payment Reversal** — Reversing a mistakenly recorded payment is handled via credit adjustments or refunds. No new "payment reversal" record type is introduced.
