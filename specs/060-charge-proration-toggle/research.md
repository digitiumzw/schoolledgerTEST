# Research: Charge Proration Toggle (060)

## D1 — Student Enrollment Date Field

**Decision**: Use `students.enrollment_date` (DATE, NOT NULL) as the proration start date for fee-rule charges scoped to `school_wide`, `class`, and `category`.

**Rationale**: The `students` table has an explicit `enrollment_date` column set at registration time. This is semantically more correct than `created_at` (which is a system timestamp, not a business date) and is already populated for all existing records. The spec assumption that `created_at` would be used is superseded by this finding.

**Alternatives considered**:
- `students.created_at` — system timestamp, less meaningful; rejected.
- `enrollments.created_at` — per-session enrollment record, correct for multi-session setups but adds a JOIN and complexity; deferred to future refinement.

---

## D2 — Transport Allocation Start Date Field

**Decision**: Use `transport_student_allocations.start_date` (DATE) as the proration start date for transport monthly charges and service-scoped fee-rule charges.

**Rationale**: The `generateMonthlyCharges` query already SELECTs `ta.start_date` from `transport_student_allocations`. No schema change required. For service-scoped fee rules in `FeeRuleBillingService::getEligibleStudents`, the eligible-student query must be extended to also return `start_date` from the transport assignment record.

**Alternatives considered**:
- `transport_assignments.start_date` — there are two transport tables. The active-allocation table (`transport_student_allocations`) is what `generateMonthlyCharges` queries; `transport_assignments` is used by the service-scope eligible-student resolver. Both carry a `start_date`; the respective query is extended to SELECT it.

---

## D3 — Proration Formula & Rounding

**Decision**: `floor(remaining_days / total_days_in_period × full_amount)` where:
- `remaining_days = (period_end - max(period_start, student_start_date)).days + 1` (inclusive, clamped to period bounds)
- `total_days_in_period` = calendar days in the billing period
- Floor rounding to avoid overcharging.

**Rationale**: Floor is the most conservative option for the school (student never overpays). The `max(period_start, student_start_date)` clamp handles the case where start_date pre-dates the period start, guaranteeing a full charge for those students.

**Alternatives considered**:
- Round-half-up: common in accounting but can charge fractional cents above pro-rata; rejected.
- Ceiling: always overcharges; rejected.

---

## D4 — Setting Storage Location

**Decision**: Store `chargeProrationEnabled` inside `tenants.settings` JSON (the same column that holds `kioskModeEnabled`, `schoolName`, etc.).

**Rationale**: No migration required. The `SettingsController::update()` and `SettingsController::index()` methods already read/write the `settings` JSON column. The pattern for boolean feature toggles in this codebase is exactly this pattern (see `kioskModeEnabled`, `studentKioskModeEnabled`, `driverKioskModeEnabled`).

**Alternatives considered**:
- New `tenants` column: requires migration; rejected per FR-014.
- Separate `tenant_features` table: over-engineered for a single flag; rejected.

---

## D5 — Frontend Placement

**Decision**: Add the proration toggle to `FeeStructureTab` (route `/settings/fee-structure`), rendered as a new `Card` below the existing fee-rules panel, using the same `Switch` + `Card` pattern as `KioskModeCard`.

**Rationale**: Proration is a billing behaviour, not a general school setting. `FeeStructureTab` already owns billing-cycle configuration and fee rules. The settings sidebar at `/settings/general` hosts kiosk toggles (attendance/operational) so separating billing toggles to the fee-structure tab maintains logical grouping. The `FeeStructureTab` route already exists in `Settings.tsx` via `SubscriptionGuard`.

**Note**: The settings sidebar (`SettingsSidebar.tsx`) currently only shows `general`, `users`, and `calendar`. A `fee-structure` entry either already exists or needs to be added. Investigation shows `FeeStructureTab` is imported but not routed in `Settings.tsx` — the route must be added.

**Alternatives considered**:
- Place in `GeneralSettingsTab` alongside kiosk toggles: mixes operational and billing settings; rejected.

---

## D6 — Proration Logic Extraction (DRY)

**Decision**: Extract proration calculation into a `ChargeProrationHelper` static class / private helper within `FeeRuleBillingService`, reused by both `FeeRuleBillingService::generateCharges()` and `TransportController::generateMonthlyCharges()`.

**Rationale**: Both generators need identical day-fraction logic (Principle VII — DRY). A shared helper avoids duplication. Given that `TransportController` and `FeeRuleBillingService` are in different layers, the cleanest approach is a simple private static method on a new `ChargeProrationHelper` class in `App\Services`, injected/called by both.

**Alternatives considered**:
- Duplicate the formula in both files: violates DRY; rejected.
- Trait: PHP traits add implicit complexity; a plain class with a static method is simpler.

---

## D7 — Integration Test Coverage

**Decision**: Extend or add a `ChargeProrationTest.php` integration test covering:
1. Toggle OFF → full charge (regression guard).
2. Toggle ON + mid-period student → prorated amount correct.
3. Toggle ON + pre-period student → full charge (no reduction).
4. Toggle ON + null enrollment_date → falls back to full charge.
5. Transport monthly charges prorated when toggle ON.
6. Fee-rule service-scoped charge prorated when toggle ON.
7. Tenant isolation (toggle from tenant A does not affect tenant B).

**Rationale**: Constitution Principle X mandates happy path, error/edge-case, and tenant isolation coverage.
