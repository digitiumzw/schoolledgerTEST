# Research: School Fee Structure & Billing Engine

**Branch**: `056-fee-structure-billing` | **Date**: 2026-05-01

## D1 — Relationship to Existing Fee Structure JSON

**Decision**: Additive — new `fee_rules` table introduced alongside the existing `tenants.fee_structure` JSON blob; the existing `billing/finalize` flow is untouched.

**Rationale**: The existing system stores default fees as `tenants.fee_structure.defaultFees` (a JSON name→amount map) and uses them in `LedgerController::finalizeBilling()`. This is a live, working flow. Migrating existing JSON data into `fee_rules` rows at migration time would risk corrupting live tenant configurations and breaking the existing billing preview/finalize/void/supplementary chain. The new feature introduces a parallel generation path via `POST /api/fee-rules/generate` that reads from `fee_rules`. Admins transition by defining their fees in the new fee rules UI; old charges remain valid historical records.

**Alternatives considered**:
- Migrate existing `defaultFees` JSON to `fee_rules` rows during migration — rejected: destructive risk, requires per-tenant data transformation in a migration file (Constitution IV violation risk)
- Replace `tenants.fee_structure` entirely — rejected: breaks existing `billing/preview`, `billing/finalize`, `billing/status` endpoints and all frontend hooks that depend on them (`useFeeStructure`, `useChargeGeneration`)

---

## D2 — Billing Period Storage & Deduplication Constraint

**Decision**: Add two nullable columns to `charges`: `fee_rule_id` (VARCHAR 50) and `billing_period` (VARCHAR 20). Monthly billing period format: `"YYYY-MM"` (e.g., `"2026-04"`). Termly billing period: uses the existing `term_id` value (e.g., `"term-1-2025"`). DB-level UNIQUE constraint on `(student_id, fee_rule_id, billing_period)`. Existing charges with `fee_rule_id = NULL` are excluded from the constraint (MySQL treats NULLs as distinct in UNIQUE indexes).

**Rationale**: A single `billing_period` string covers both cycle types without branching in the constraint definition. `NULL` exemption preserves full backward compatibility with legacy charges. The constraint handles concurrent generation attempts from two admin sessions without application-level locking (Constitution V + XI).

**Alternatives considered**:
- Separate `billing_month` + `billing_year` INT columns — works but requires a compound conditional unique key and extra NULL-handling for termly periods
- Reuse existing `term_id` + application-level dedup — rejected: insufficient for monthly cycle (no term_id for a month), and application-level checking is race-condition-prone (Constitution V)
- Use `billing_run_id` for dedup — rejected: provides run-level dedup, not per-rule per-student dedup

---

## D3 — Service Layer Architecture for Billing Engine

**Decision**: New `FeeRuleBillingService` class with three public methods:
1. `generateCharges(string $tenantId, string $billingPeriod, string $userId): array` — main engine, returns `GenerationResult`
2. `getEligibleStudents(string $tenantId, array $feeRule): array` — resolves students for a single rule's scope
3. `getUnbilledCount(string $tenantId): int` — for billing tab alert

**Rationale**: Constitution Principle II (API-First Separation of Concerns) requires business logic in services, not controllers. The billing engine logic is complex enough (4 scope types, transaction management, skip tracking) to justify extraction. The controller remains thin: validate input → call service → return response.

**Alternatives considered**:
- Fat controller (existing pattern in `LedgerController::finalizeBilling`) — rejected: the existing pattern predates the constitution; new features must comply
- Logic in `FeeRuleModel` — rejected: models own data access, not business orchestration

---

## D4 — "Service" Scope Type Implementation (US4, P2)

**Decision**: For `assignment_scope_type = 'service'` and `assignment_scope_id = 'transport'`, the billing engine queries the `transport_assignments` table for active assignments covering the billing period. No new generic "service enrollment" table is introduced at this stage.

**Rationale**: Spec assumption: "Services available are limited to services already tracked in the system (e.g., transport assignments)." The `transport_assignments` table exists and has the `is_active` flag and date fields needed for period eligibility checks. This is the minimal correct implementation for P2. A generic service enrollment abstraction is deferred to a future feature.

**Alternatives considered**:
- Generic `service_enrollments` table — rejected: over-engineering for P2 scope with only one service type currently tracked
- Query `charges` for existing transport charges as a proxy for enrollment — rejected: circular dependency, doesn't check actual enrollment status

---

## D5 — "Current Billing Period" for Unbilled-Student Alert

**Decision**: 
- Monthly school: `billing_period = date('Y-m')` (current calendar month, server time)
- Termly school: `billing_period = AcademicCalendarService::getCurrentTerm()['id']` (returns `null` if between terms or calendar unconfigured → no alert shown)
- Implementation: `FeeRuleBillingService::getUnbilledCount()` calls `AcademicCalendarService` — already available in the project — for termly resolution

**Rationale**: Reuses existing `AcademicCalendarService` (no new calendar logic). Monthly requires no calendar lookup — always the current calendar month. Alert suppression when no active term is consistent with spec FR-020 and clarification Q4.

**Alternatives considered**:
- Persist "last generated period" in `billing_runs` and use that as the reference — adds statefulness; breaks for the first run before any generation has occurred
- Admin-selected period for the alert — rejected by spec (clarification Q4 chose Option A)

---

## D6 — Billing Cycle Source of Truth

**Decision**: Read `feeStructure.structureType` from `tenants.fee_structure` JSON (already stored by `047-fee-billing-cycle` feature). The `FeeRuleBillingService` reads this field to validate the submitted billing period type. The `FeeRuleController` returns the school's `structureType` as part of the generation metadata endpoint so the frontend can render the correct period selector.

**Rationale**: `047-fee-billing-cycle` already stores and manages `structureType` in `tenants.fee_structure`. No new column needed. Adding a duplicate storage location would create a source-of-truth conflict.

**Alternatives considered**:
- New dedicated `billing_cycle` column on `tenants` — rejected: redundant with existing `fee_structure.structureType`
- Let frontend determine cycle from `useFeeStructure` hook (already loads structureType) — acceptable for UI, but backend must also validate period type independently (Defense in depth, Constitution VIII)
