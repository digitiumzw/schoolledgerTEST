# Tasks: Fix Dashboard KPIs & Layout

**Input**: Design documents from `/specs/070-fix-dashboard-kpis/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Organization**: Tasks grouped by user story. No new files, no migrations. All backend changes in `DashboardAggregationService.php`; frontend changes in existing section components + `Dashboard.tsx`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Verify branch, confirm dev environment, no migrations to run.

- [x] T001 Confirm active branch is `070-fix-dashboard-kpis` and backend/frontend dev servers are running
- [x] T002 Run `php -l backend/app/Services/DashboardAggregationService.php` to confirm baseline lint passes

---

## Phase 2: Foundational — Backend KPI Engine

**Purpose**: All financial and aggregation computation fixes live in `DashboardAggregationService.php`. These must be complete before any frontend story work begins.

**⚠️ CRITICAL**: Frontend stories depend on correct data being returned from the backend.

- [x] T003 In `backend/app/Services/DashboardAggregationService.php`: fix `paymentCollectionRate()` to accept `?array $currentTerm` param — scope charges by `term_id = currentTerm['id']` with `LedgerService::ELIGIBLE_CHARGE_TYPES` filter + voided/deleted exclusion; scope payments by `date >= termStart AND date <= termEnd` with `LedgerService::ELIGIBLE_PAYMENT_CATEGORIES` filter and `fee_campaign_id IS NULL`; return 0.0 when no active term or no term charges
- [x] T004 In `backend/app/Services/DashboardAggregationService.php`: fix `paymentsCollected()` to add `LedgerService::eligiblePaymentCategorySqlList()` filter and `fee_campaign_id IS NULL` to the query, so `total_revenue_this_term` counts only eligible payments
- [x] T005 In `backend/app/Services/DashboardAggregationService.php`: fix `lowAttendanceStudents()` to accept `string $termStart, string $termEnd` params; add `AND a.date >= ? AND a.date <= ?` to the attendance subquery; pass empty-term guard (return 0 when no active term)
- [x] T006 In `backend/app/Services/DashboardAggregationService.php`: fix `activeStaff()` (used for `total_staff`) to remove the `employment_status = 'active'` filter so it counts ALL staff regardless of status; rename the method to `totalStaff()` or add a separate `allActiveStaff()` method that keeps the `employment_status = 'active'` filter
- [x] T007 In `backend/app/Services/DashboardAggregationService.php`: add new private `nonTeachingStaff()` method — `COUNT(staff WHERE tenant_id = ? AND is_teaching = 0)` with NO `employment_status` filter; replace the derived `max(0, totalStaff - teachingStaff)` computation with a direct call to this new method
- [x] T008 In `backend/app/Services/DashboardAggregationService.php`: add `all_active_staff` metric to `computeMetrics()` using the active-only staff count (former `activeStaff()` logic); update `formatStatsSnapshot()` to populate `allActiveStaff` from the new `all_active_staff` metric key
- [x] T009 In `backend/app/Services/DashboardAggregationService.php`: fix `staffAttendanceRate()` to use denominator `allActiveStaff - staffOnLeaveToday` instead of raw `activeStaff`; return 0.0 when denominator is ≤ 0 (guard against division by zero)
- [x] T010 In `backend/app/Services/DashboardAggregationService.php`: remove `high_overdue_balances` and `teaching_staff_with_classes` from the `snapshotMetricKeys()` array and from `computeMetrics()` to stop computing and storing these metrics
- [x] T011 In `backend/app/Services/DashboardAggregationService.php`: add `all_active_staff` to the `snapshotMetricKeys()` array so it is included in the dashboard snapshot response
- [x] T012 In `backend/app/Services/DashboardAggregationService.php`: update `computeMetrics()` to thread `$currentTerm`, `$termStart`, `$termEnd` into the updated `paymentCollectionRate()`, `lowAttendanceStudents()`, and `paymentsCollected()` (for term revenue) calls
- [x] T013 Run `php -l backend/app/Services/DashboardAggregationService.php` — must return no errors

**Checkpoint**: Backend KPI computation fully corrected. `GET /api/dashboard?refresh=true` returns correct values for all metrics.

---

## Phase 3: User Story 1 — Accurate Financial KPIs (Priority: P1) 🎯

**Goal**: Collection Rate, Term Revenue, Paid in Full, and Total Outstanding all display correct scope-accurate values. No-active-term guard shows gracefully.

**Independent Test**: Load dashboard, compare Financial Summary KPI cards against manual SQL calculation for charges/payments in the current term.

- [x] T014 [US1] In `frontend/src/components/dashboard/FinancialSection.tsx`: add no-active-term guard — when `stats?.currentTermName` is `null`, set the `description` on the Collection Rate, Paid in Full, and Term Revenue `MetricTile` cards to `"No active term configured"` instead of the normal description text
- [x] T015 [US1] In `frontend/src/components/dashboard/FinancialSection.tsx`: verify `collectionRate` and `termRevenue` tiles already pass `tooltip` prop — confirm tooltips render on hover (all four cards already have tooltip strings set; this is a verification task)

**Checkpoint**: Financial Section displays correct term-scoped values; no-term state renders gracefully.

---

## Phase 4: User Story 2 — Accurate Enrolment & Academics KPIs (Priority: P1) 🎯

**Goal**: Total Students (active only), Total Classes (non-archived), Average Class Size, On Bursary, and Enrollment by Class gender table all display correct values.

**Independent Test**: Compare dashboard Enrolment KPIs against Students list page (active filter) and Classes list page (non-archived filter).

- [x] T016 [US2] In `frontend/src/components/dashboard/EnrolmentSection.tsx`: verify all four KPI tiles pass `tooltip` prop strings — they already do per current code; confirm no changes needed (verification task)
- [x] T017 [US2] In `backend/app/Services/DashboardAggregationService.php`: verify `classSummary()` only counts `WHERE archived_at IS NULL` — no `status` column exists on `classes` table in this codebase, so archived_at-only filter is the correct approach; confirm no change needed (verification task)

**Checkpoint**: Enrolment Section displays correct active-only values. No code changes expected — this phase is verification.

---

## Phase 5: User Story 3 — Accurate Students & Alerts KPIs (Priority: P1) 🎯

**Goal**: Low Attendance is term-scoped, High Overdue Balances card is removed, Outstanding Balances is present, Over-Capacity Classes remains.

**Independent Test**: Verify three KPI cards visible (Low Attendance, Outstanding Balances, Over-Capacity Classes) and High Overdue Balances card is completely absent from the DOM.

- [x] T018 [US3] In `frontend/src/components/dashboard/StudentsAlertsSection.tsx`: remove the `<AlertCard>` block for "High Overdue Balances" entirely (the card with `title="High Overdue Balances"` and `value={highOverdue}`)
- [x] T019 [P] [US3] In `frontend/src/components/dashboard/StudentsAlertsSection.tsx`: add `tooltip` prop support to `AlertCardProps` interface and `AlertCard` function — render a shadcn `<TooltipProvider>/<Tooltip>/<TooltipTrigger>/<TooltipContent>` wrapping the existing `<Card>` when `tooltip` is provided (same pattern as `MetricTile.tsx`)
- [x] T020 [P] [US3] In `frontend/src/components/dashboard/StudentsAlertsSection.tsx`: add `tooltip` prop to each of the three remaining `<AlertCard>` instances: Low Attendance (`"Students whose attendance is below 75% for the current academic term. Requires an active term."`), Outstanding Balances (`"Students who owe any positive amount across all terms, regardless of when the charges were raised."`); for Over-Capacity Classes use inline `<TooltipProvider>` on the raw `<Card>` with tooltip `"Active classes where enrolled active student count exceeds the configured class capacity."`

**Checkpoint**: Students & Alerts section shows exactly 3 cards with tooltips; High Overdue Balances card absent.

---

## Phase 6: User Story 4 — Accurate Staff Overview KPIs (Priority: P2)

**Goal**: Total Staff counts all statuses; Non-Teaching Staff is independently computed; All Active Staff is distinct from Total Staff; Teaching w/ Active Classes card removed; attendance rate excludes on-leave from denominator; all cards have tooltips.

**Independent Test**: Verify 6 KPI cards visible in Staff Overview; Teaching w/ Active Classes absent; Total Staff ≥ All Active Staff.

- [x] T021 [US4] In `frontend/src/components/dashboard/StaffOverviewSection.tsx`: remove the `<StaffMetricCard>` block for "Teaching w/ Active Classes" entirely (the card with `title="Teaching w/ Active Classes"`)
- [x] T022 [P] [US4] In `frontend/src/components/dashboard/StaffOverviewSection.tsx`: update "Total Staff" card `description` from `"Active employees"` to `"All staff regardless of status"`
- [x] T023 [P] [US4] In `frontend/src/components/dashboard/StaffOverviewSection.tsx`: update "All Active Staff" card `description` from `"Currently employed"` to `"Staff with active employment status"`
- [x] T024 [P] [US4] In `frontend/src/components/dashboard/StaffOverviewSection.tsx`: update "Today's Attendance Rate" card `description` from `"Checked in today"` to `"Checked in today (excludes staff on leave)"`
- [x] T025 [US4] In `frontend/src/components/dashboard/StaffOverviewSection.tsx`: add `tooltip` prop support to `StaffMetricCardProps` interface and `StaffMetricCard` function — render shadcn `<TooltipProvider>/<Tooltip>/<TooltipTrigger>/<TooltipContent>` wrapping the `<Card>` when `tooltip` is provided
- [x] T026 [US4] In `frontend/src/components/dashboard/StaffOverviewSection.tsx`: add `tooltip` string to each of the 6 remaining `<StaffMetricCard>` instances using the tooltip text from `contracts/dashboard-kpis.md`: Total Staff, Teaching Staff, Non-Teaching Staff, All Active Staff, Staff On Leave Today, Today's Attendance Rate

**Checkpoint**: Staff Overview section shows exactly 6 cards with tooltips; Teaching w/ Active Classes absent; descriptions accurate.

---

## Phase 7: User Story 5 — Transport KPIs Remain Accurate (Priority: P2)

**Goal**: Active Routes and Students on Transport display correct values with tooltips.

**Independent Test**: Dashboard Transport section shows 2 cards with tooltips matching values from `/api/transport/routes`.

- [x] T027 [US5] In `frontend/src/components/dashboard/TransportOverviewSection.tsx`: wrap each raw `<Card>` in a `<TooltipProvider>/<Tooltip>/<TooltipTrigger>/<TooltipContent>` block — Active Routes tooltip: `"Transport routes currently marked as active in the system."` — Students on Transport tooltip: `"Active students with an active allocation to at least one active transport route."`

**Checkpoint**: Transport section cards render tooltips on hover.

---

## Phase 8: User Story 6 — KPI Tooltips & UX Improvements (Priority: P2)

**Goal**: Refresh KPIs button removed, Quick Actions compact, all sections have tooltips (covered in prior phases).

**Independent Test**: No Refresh KPIs button in DOM; Quick Actions buttons visually compact; all KPI cards show tooltips on hover.

- [x] T028 [US6] In `frontend/src/pages/Dashboard.tsx`: remove the `<Button>` element labelled "Refresh KPIs" (lines containing `refreshNow()`, `isRefreshing`, and the `<RefreshCw>` button — the Button element only, keep `refreshNow`/`isRefreshing` state and `refetchAggregation` calls elsewhere if used)
- [x] T029 [US6] In `frontend/src/pages/Dashboard.tsx`: remove the `RefreshCw` import from lucide-react if it is only used by the now-deleted Refresh KPIs button
- [x] T030 [US6] In `frontend/src/components/dashboard/QuickActions.tsx`: change `size="lg"` to `size="sm"` on all four `<Button>` elements (Add Student, Record Payment, Mark Attendance, View Reports)
- [x] T031 [US6] In `frontend/src/pages/Dashboard.tsx`: add `className="py-3"` to the `<CardContent>` wrapping `<QuickActions>` to reduce vertical padding of the Quick Actions card

**Checkpoint**: Dashboard header has no Refresh KPIs button; Quick Actions section is visually compact; all KPI sections have tooltips.

---

## Phase 9: Polish & Validation

**Purpose**: Lint, type-check, ESLint, and curl validation.

- [x] T032 [P] Run `php -l backend/app/Services/DashboardAggregationService.php` — must return no syntax errors
- [x] T033 [P] Run `cd frontend && node node_modules/typescript/bin/tsc --noEmit --pretty false` — must return 0 errors
- [x] T034 Run targeted ESLint per `quickstart.md`: `./node_modules/.bin/eslint src/pages/Dashboard.tsx src/components/dashboard/StudentsAlertsSection.tsx src/components/dashboard/StaffOverviewSection.tsx src/components/dashboard/TransportOverviewSection.tsx src/components/dashboard/QuickActions.tsx src/components/dashboard/FinancialSection.tsx`
- [x] T035 Run curl validation per `quickstart.md`: login, `GET /api/dashboard?refresh=true`, verify `collectionRate` is term-scoped, `totalStaff` includes all statuses, `allActiveStaff` ≤ `totalStaff`, `staffAttendanceRate` computed with leave exclusion
- [x] T036 Run curl tenant isolation check: second-tenant admin gets different `totalStudents` value from `/api/dashboard`
- [x] T037 Run curl no-auth guard: `GET /api/dashboard` without token returns HTTP 401
- [x] T038 Update `quickstart.md` Validation Results section with actual pass/fail outcomes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational Backend)**: Depends on Phase 1
- **Phase 3–8 (User Stories)**: Depend on Phase 2 — US1/US2/US3 are P1 and should be done first; US4/US5/US6 are P2 and can follow in any order
- **Phase 9 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (Financial KPIs)**: Depends on Phase 2 (T003, T004, T012)
- **US2 (Enrolment)**: Independent verification — no Phase 2 changes required
- **US3 (Students & Alerts)**: Depends on Phase 2 (T005, T010)
- **US4 (Staff Overview)**: Depends on Phase 2 (T006, T007, T008, T009, T011)
- **US5 (Transport)**: Frontend-only; independent of Phase 2
- **US6 (UX)**: Frontend-only; independent of Phase 2; T028 depends on verifying which imports to remove (T029)

### Parallel Opportunities

- T003–T012 (Phase 2 backend): sequential within the same file — must be done in order
- T014–T015 (US1), T018–T020 (US3), T021–T026 (US4), T027 (US5), T028–T031 (US6): parallelisable across stories since they touch different component files
- Within US3: T019 and T020 are marked [P] — both modify `StudentsAlertsSection.tsx` but T020 depends on T019 (tooltip support added first, then applied)
- Within US4: T022, T023, T024 marked [P] — description-only updates, no dependencies
- T032 and T033 (lint/tsc) marked [P] — independent tools

---

## Parallel Example: Backend Phase + Frontend Stories

```bash
# After Phase 1 complete:
# Backend Phase 2 (sequential, one file):
T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013

# After Phase 2 complete, frontend stories can run in parallel:
US1 (T014, T015) — FinancialSection.tsx
US3 (T018, T019, T020) — StudentsAlertsSection.tsx
US4 (T021–T026) — StaffOverviewSection.tsx
US5 (T027) — TransportOverviewSection.tsx
US6 (T028–T031) — Dashboard.tsx + QuickActions.tsx
```

---

## Implementation Strategy

### MVP First (P1 Stories — US1, US2, US3)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Backend fixes (T003–T013) — CRITICAL
3. Complete Phase 3: US1 Financial KPIs (T014–T015)
4. Complete Phase 4: US2 Enrolment verification (T016–T017)
5. Complete Phase 5: US3 Students & Alerts (T018–T020)
6. **STOP and VALIDATE**: Run lint + tsc + curl financial validation
7. Demo: all P1 KPIs correct, High Overdue Balances removed

### Full Delivery (P2 Stories)

8. Complete Phase 6: US4 Staff Overview (T021–T026)
9. Complete Phase 7: US5 Transport tooltips (T027)
10. Complete Phase 8: US6 UX improvements (T028–T031)
11. Complete Phase 9: Full validation (T032–T038)

---

## Notes

- All Phase 2 tasks modify the same file (`DashboardAggregationService.php`) — execute sequentially
- `MetricTile.tsx` already supports `tooltip` prop — no changes needed to that component
- `EnrolmentSection.tsx` is already correct — Phase 4 is a verification-only phase
- T029 (removing `RefreshCw` import) depends on confirming no other usage of that import after T028 — check before removing
- The `highOverdueBalances` and `teachingStaffWithClasses` fields remain in the `DashboardStats` TypeScript type for backward safety; they just stop being rendered
- Avoid: modifying `MetricTile.tsx`, `DashboardSection.tsx`, `api.ts`, or `dashboard.ts` — changes are scoped to the 5 section components + `Dashboard.tsx` + `DashboardAggregationService.php`
