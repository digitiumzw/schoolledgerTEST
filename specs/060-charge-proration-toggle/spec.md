# Feature Specification: Charge Proration Toggle

**Feature Branch**: `060-charge-proration-toggle`
**Created**: 2026-05-04
**Status**: Draft
**Input**: User description: "In the settings, add an option that allows the user to toggle whether charge proration should be applied. This should handle cases where a student is enrolled or assigned to a service (e.g., transport charges, fee rules charges) after charges for that period have already been generated."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Configures Proration Behaviour (Priority: P1)

An admin opens the Settings page and finds a new "Charge Proration" toggle in the Billing / Fee Structure section. They can enable it (on) to allow the system to calculate a reduced charge for students who join mid-period, or disable it (off) to always charge the full amount regardless of join date. The change takes effect on the next charge generation run.

**Why this priority**: This is the single entry point for the entire feature. Without it nothing else is reachable.

**Independent Test**: Enable the toggle and save. Reload settings and confirm the saved state is returned. Trigger charge generation for a student enrolled mid-period and confirm the charged amount is prorated.

**Acceptance Scenarios**:

1. **Given** the Settings page is open, **When** the admin toggles "Charge Proration" on and saves, **Then** the setting is persisted against the tenant and the toggle reflects the saved state on next page load.
2. **Given** the toggle is **off** (default), **When** charge generation runs for any service or fee rule, **Then** every eligible student receives the full charge amount regardless of when they were enrolled or assigned.
3. **Given** the toggle is **on**, **When** charge generation runs and a student's enrollment or assignment start date falls strictly after the start of the billing period, **Then** the system charges only the proportional amount (remaining days ÷ total days in period × full amount, rounded down).
4. **Given** the toggle is **on**, **When** a student's enrollment or assignment start date is on or before the billing period start, **Then** the full charge amount is applied with no reduction.

---

### User Story 2 - Prorated Charge Visibility (Priority: P2)

When a prorated charge is generated, the charge record's description includes the day-fraction used so admins and bursars can audit why a student was charged less than the standard amount.

**Why this priority**: Traceability is important for financial integrity but does not block the core toggle; it is an additive enhancement to charge descriptions.

**Independent Test**: With proration enabled, generate charges for a mid-period enrollee. View the student's charge list and confirm the description shows the proration basis (e.g., "Term 1 – prorated 18/90 days").

**Acceptance Scenarios**:

1. **Given** proration is enabled, **When** a prorated charge is created, **Then** the charge description includes the day-fraction used (e.g., "Fee Rule Name (2026-05) – prorated 18/31 days").
2. **Given** proration is enabled, **When** a full-period charge is created (student joined before or on period start), **Then** the description contains no proration annotation and is identical to today's output.

---

### User Story 3 - Proration Applies to Both Charge Types (Priority: P2)

The proration setting applies consistently to both fee-rule–generated charges (via the billing engine) and transport monthly charges (via the transport charge generator), giving the admin a single unified control rather than per-module switches.

**Why this priority**: Consistency avoids partial billing errors and admin confusion; each charge type can be verified independently once the toggle is wired to both generators.

**Independent Test**: With proration on, trigger transport charge generation and fee-rule charge generation separately for a mid-period student and verify both produce prorated amounts.

**Acceptance Scenarios**:

1. **Given** proration is enabled and a student was assigned to a transport route 10 days into a 31-day month, **When** transport monthly charges are generated for that month, **Then** the student receives a charge of `floor(22 / 31 × monthly_fee)`.
2. **Given** proration is enabled and a student was enrolled into a class 10 days into the billing period, **When** fee-rule charges are generated for that period, **Then** the student receives a prorated charge for each applicable rule.
3. **Given** proration is **disabled**, **When** the same scenarios occur, **Then** both charge types use the full amount (no regression).

---

### Edge Cases

- What happens when a student's start date is after the billing period ends? The student should not appear as eligible at all (existing behaviour — no charge generated).
- What happens when the billing period is a single day and the student joins on that day? Full charge applies (remaining days = total days = 1).
- What happens when the calculated prorated amount rounds to zero? The charge is still created with amount `0` to maintain audit completeness; a zero-value charge is valid.
- What happens if a student's enrollment or assignment start date is unavailable or null? Fall back to full charge (no proration applied), treating the student as if they were present for the full period.
- How does the system behave when proration is toggled between billing runs? Only charges generated after the toggle change are affected; existing charges are never retroactively recalculated.
- What happens for termly billing periods? The period spans the term's configured start and end dates from the academic calendar; the same day-fraction logic applies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Settings page MUST include a "Charge Proration" toggle (boolean on/off) visible to admin, bursar, and super_admin roles.
- **FR-002**: Only admin and super_admin roles MUST be able to save the toggle; bursar can view it but not change it (consistent with existing settings permissions).
- **FR-003**: The toggle value MUST be persisted per-tenant in the existing settings store and returned in the settings API response as `chargeProrationEnabled`.
- **FR-004**: The default value for `chargeProrationEnabled` MUST be `false` to preserve current full-charge behaviour for all existing tenants without any data migration.
- **FR-005**: When `chargeProrationEnabled` is `false`, both charge generators (fee-rule billing engine and transport monthly charges) MUST produce full-amount charges exactly as today — no change in behaviour.
- **FR-006**: When `chargeProrationEnabled` is `true`, the billing engine MUST calculate a prorated amount for any student whose service start date falls strictly after the first day of the billing period.
- **FR-007**: The prorated amount MUST be calculated as `floor(remaining_days / total_days_in_period × full_amount)`, where `remaining_days = period_end_date - student_start_date + 1` (inclusive of start day) and `total_days_in_period` = total calendar days in the billing period.
- **FR-008**: For fee-rule charges scoped to `school_wide`, `class`, or `category`, the system MUST use the student's enrollment/created date as the proration start date.
- **FR-009**: For fee-rule charges scoped to `service` (transport route), the system MUST use the transport assignment's `start_date` as the proration start date.
- **FR-010**: For transport monthly charges (generated by the transport charge generator), the system MUST use the transport allocation's `start_date` as the proration start date.
- **FR-011**: When a charge is prorated (amount < full amount), the charge description MUST include the annotation "– prorated X/Y days" appended to the existing description.
- **FR-012**: When a charge is NOT prorated (full amount), the description MUST remain identical to today's output (no annotation added).
- **FR-013**: The proration toggle MUST only affect future charge generation runs; existing charge records MUST never be modified retroactively.
- **FR-014**: No new database migrations are required; the setting is stored in the existing per-tenant settings JSON column.

### Key Entities

- **Tenant Settings** (`tenants.settings` JSON): Gains a new `chargeProrationEnabled` boolean field (default `false`).
- **Charge** (`charges` table): The `description` field is reused to carry the proration annotation when applicable. No new columns required.
- **Fee-Rule Billing Engine**: Reads `chargeProrationEnabled` and, when true, computes prorated amounts per student per rule using the student's enrollment date.
- **Transport Charge Generator**: Reads `chargeProrationEnabled` and applies the same day-fraction logic using the transport allocation's start date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can enable or disable charge proration from the Settings page without leaving the billing/fee-structure section.
- **SC-002**: With proration enabled, a student who joins exactly halfway through a 30-day month is charged 50% (±1 cent rounding via floor) of the standard fee for that period.
- **SC-003**: With proration disabled, the same mid-month student is charged 100% of the standard fee — no regression from current behaviour.
- **SC-004**: The proration setting survives a full page reload (persisted server-side, not client-side state only).
- **SC-005**: Prorated charge descriptions contain a "prorated X/Y days" annotation visible in the student charge list.
- **SC-006**: Zero new database migrations are required; the setting is stored in the existing `tenants.settings` JSON column.
- **SC-007**: Full-period charges (student joined before or on period start) produce descriptions identical to today's output — no unintended annotation.

## Assumptions

- The billing period for monthly billing is a full calendar month (e.g., 2026-05-01 to 2026-05-31); for termly billing, the period spans the term's `start_date` to `end_date` from the academic calendar.
- The "enrollment start date" for fee-rule charges (school-wide, class, category scopes) is the student record's `created_at` date. If a more precise class-enrollment date is available in the future, the implementation can be refined, but `created_at` is the reasonable default given the current schema.
- Rounding uses `floor` (round down to nearest cent) to avoid overcharging students.
- The feature does not introduce a new database migration; all state resides in the existing `tenants.settings` JSON column.
- Multi-class and service-scoped fee rules already resolve eligible students correctly; proration layers on top without changing eligibility logic.
- No retrospective recalculation: the feature only affects charges generated after the toggle is saved.
- The frontend Settings page already has sections for kiosk toggles and fee structure; the proration toggle will be placed in the Billing / Fee Structure tab alongside existing toggles.
