# Tasks: Staff Attendance Tracking (067)

**Input**: Design documents from `/specs/067-staff-attendance-tracking/`  
**Branch**: `067-staff-attendance-tracking`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Git branch checkout and migration scaffolding.

- [ ] T001 Checkout branch `067-staff-attendance-tracking` (or create from main if not yet done)
- [ ] T002 Create migration file `backend/app/Database/Migrations/2026-05-08-000001_ExtendStaffAttendanceForTracking.php` with ALTER to add `early_departure` to `staff_attendance.status` ENUM and ADD `overtime_hours DECIMAL(5,2) NULL` column

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service and model infrastructure that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until T003–T005 are complete.

- [ ] T003 Create `backend/app/Services/StaffAttendanceService.php` with method stubs: `getWorkHoursConfig()`, `classifyStatus()`, `calculateOvertimeHours()`, `syncLeaveToAttendance()`, `voidLeaveAttendance()` — stubs only, no logic yet
- [ ] T004 [P] Add `overtime_hours` to `$allowedFields` in `backend/app/Models/AttendanceModel.php`
- [ ] T005 [P] Add `overtimeHours` field to `StaffAttendanceRecord` interface in `frontend/src/types/dashboard.ts`

**Checkpoint**: Migration + service scaffold + model/type extensions ready — user story work can begin.

---

## Phase 3: User Story 1 — Daily Attendance Event Logging (Priority: P1) 🎯 MVP

**Goal**: Staff check-in/check-out records the correct status (`present`, `late`, `early_departure`, `half_day`) automatically derived from configured work-hours thresholds. No manual status flag needed.

**Independent Test**: Log a check-in at 09:10 and check-out at 15:00 for a staff member. Verify `status=late` is stored on check-in, then `status=early_departure` is re-classified on check-out. Verify `workHours ≈ 5.83`, `overtimeHours = 0`. Verify a duplicate check-in is rejected or upserted.

### Implementation for User Story 1

- [ ] T006 [US1] Implement `StaffAttendanceService::getWorkHoursConfig(string $tenantId): array` in `backend/app/Services/StaffAttendanceService.php` — reads `tenants.settings` JSON for `staffWorkHours.startTime` / `staffWorkHours.endTime`, derives `standardHours`, falls back to `08:30`/`17:00`/`8.5`
- [ ] T007 [US1] Implement `StaffAttendanceService::classifyStatus()` in `backend/app/Services/StaffAttendanceService.php` — logic: `half_day` if `work_hours < standardHours/2`; `early_departure` if `check_out < endTime`; `late` if `check_in > startTime`; else `present`
- [ ] T008 [US1] Implement `StaffAttendanceService::calculateOvertimeHours()` in `backend/app/Services/StaffAttendanceService.php` — returns `MAX(0, workHours - standardHours)`
- [ ] T009 [US1] Refactor `AttendanceController::checkIn()` in `backend/app/Controllers/Api/AttendanceController.php` — delegate status classification to `StaffAttendanceService::classifyStatus()` instead of inline logic; block check-in for `employment_status != 'active'` staff
- [ ] T010 [US1] Refactor `AttendanceController::checkOut()` in `backend/app/Controllers/Api/AttendanceController.php` — after computing `workHours`, call `StaffAttendanceService::classifyStatus()` to re-derive status; call `StaffAttendanceService::calculateOvertimeHours()` to compute and persist `overtime_hours`; update response to include `overtimeHours` and revised `status`
- [ ] T011 [US1] Refactor `AttendanceController::recordStaffAttendance()` in `backend/app/Controllers/Api/AttendanceController.php` — when `checkIn` + `checkOut` both provided, compute `work_hours` and `overtime_hours` via service; include `early_departure` in accepted status values
- [ ] T012 [US1] Run migration: `php spark migrate` and verify `staff_attendance` table has `overtime_hours` column and `early_departure` ENUM value
- [ ] T013 [US1] Update `api.ts` in `frontend/src/api/api.ts` — add `overtimeHours` to the inline record type returned by `getPagedStaffAttendance()`; update `checkOutStaff` return type to include `overtimeHours: number` and `status: string`

**Checkpoint**: US1 fully functional. Check-in/check-out status is auto-classified, overtime is computed and stored. Smoke test with `quickstart.md` steps 3 & 4.

---

## Phase 4: User Story 2 — Working Hours & Overtime Calculation (Priority: P1) 🎯 MVP

**Goal**: Period summaries return total hours worked, total overtime hours, and per-day breakdown for a staff member or period. `staffSummary` endpoint extended with `earlyDeparture` and `totalOvertimeHours`.

**Independent Test**: After completing US1 events, call `GET /api/staff-attendance/summary/:staffId?month=YYYY-MM`. Verify `totalOvertimeHours`, `earlyDeparture` count, and `attendanceRate` are present and correct.

### Implementation for User Story 2

- [ ] T014 [US2] Update `AttendanceController::staffSummary()` in `backend/app/Controllers/Api/AttendanceController.php` — add counts for `earlyDeparture` (status=`early_departure`) and `totalOvertimeHours` (SUM of `overtime_hours`) to the returned summary object; update `getStaffMonthSummary()` private helper similarly
- [ ] T015 [US2] Update `AttendanceModel::getMonthlySummary()` in `backend/app/Models/AttendanceModel.php` — add `SUM(CASE WHEN a.status = 'early_departure' THEN 1 ELSE 0 END) AS early_departure_days` and `SUM(a.overtime_hours) AS total_overtime_hours` to the SELECT
- [ ] T016 [US2] Add `AttendanceModel::getPeriodReport()` method in `backend/app/Models/AttendanceModel.php` — single SQL aggregate query joining `staff` and `staff_attendance` for a `start_date`/`end_date` range; optional `department` and `staff_id` filters; returns per-staff aggregates including `totalOvertimeHours`, `earlyDeparture`, `attendanceRate`
- [ ] T017 [US2] Add `AttendanceController::periodReport()` method in `backend/app/Controllers/Api/AttendanceController.php` — validates `start_date` + `end_date` required, validates date format, enforces max 366-day range, enforces `admin`/`super_admin` role; calls `AttendanceModel::getPeriodReport()`; returns empty `staff: []` not error when no data
- [ ] T018 [US2] Register new routes in `backend/app/Config/Routes.php` — add `$routes->get('staff-attendance/report', ...)` and `$routes->get('staff-attendance/departments', ...)` **before** the `staff-attendance/(:segment)` wildcard
- [ ] T019 [US2] Add `AttendancePeriodReport` and `AttendancePeriodSummaryStaff` TypeScript interfaces to `frontend/src/api/api.ts`
- [ ] T020 [US2] Add `api.getAttendancePeriodReport()` method in `frontend/src/api/api.ts` — calls `GET /staff-attendance/report` with `start_date`, `end_date`, optional `department` and `staff_id` query params
- [ ] T021 [US2] Create `frontend/src/hooks/useStaffAttendanceReport.ts` — React Query hook wrapping `api.getAttendancePeriodReport()` with `enabled` guard and sensible staleTime

**Checkpoint**: US2 fully functional. Period report endpoint returns correct aggregates including overtime. Smoke test with `quickstart.md` steps 6 & 7.

---

## Phase 5: User Story 3 — Leave Management & Attendance Integration (Priority: P2)

**Goal**: Approving a leave request auto-creates `on_leave` attendance rows (one per working day, Mon–Fri) with `source='leave_sync'`. Cancelling/rejecting a previously approved leave voids those rows. Check-in against a leave-covered date warns rather than silently overwriting.

**Independent Test**: Create a leave request for 3 working days, approve it. Verify 3 `staff_attendance` rows appear with `status=on_leave, source=leave_sync`. Reject the approved leave. Verify those 3 rows are deleted. Attempt check-in on a leave-covered date and verify 409/warning response.

### Implementation for User Story 3

- [ ] T022 [US3] Implement `StaffAttendanceService::syncLeaveToAttendance(array $leaveRow, string $tenantId): void` in `backend/app/Services/StaffAttendanceService.php` — computes Mon–Fri working days between `start_date` and `end_date`; skips dates with existing `source='manual'` records; bulk-inserts `on_leave` rows with `source='leave_sync'` and `remarks` containing leave request ID; runs in DB transaction
- [ ] T023 [US3] Implement `StaffAttendanceService::voidLeaveAttendance(array $leaveRow, string $tenantId): void` in `backend/app/Services/StaffAttendanceService.php` — deletes `staff_attendance` rows where `source='leave_sync'` AND `staff_id` matches AND `date` is within leave range; runs in DB transaction
- [ ] T024 [US3] Modify `LeaveController::review()` in `backend/app/Controllers/Api/LeaveController.php` — after setting status to `approved`, call `StaffAttendanceService::syncLeaveToAttendance()`; if `approved` is being changed to `rejected`, call `StaffAttendanceService::voidLeaveAttendance()`; include `syncedAttendanceDays` count in response
- [ ] T025 [US3] Add leave-conflict check in `AttendanceController::checkIn()` in `backend/app/Controllers/Api/AttendanceController.php` — before writing check-in, query `leave_requests` for approved leave covering the date/staff; if found, return HTTP 409 with message `"Approved leave exists for this date; pass force=true to override"`; handle `force=true` body param to allow override
- [ ] T026 [US3] Update `frontend/src/api/api.ts` — update `reviewLeaveRequest()` return type to include `syncedAttendanceDays?: number`; update `checkInStaff()` to accept optional `force?: boolean` body param
- [ ] T027 [US3] Update `useStaffAttendanceData.ts` in `frontend/src/hooks/useStaffAttendanceData.ts` — add `leaveConflict` state handling in `useCheckInMutation` to surface 409 conflict to UI for user confirmation before retrying with `force=true`

**Checkpoint**: US3 fully functional. Leave approval auto-creates attendance rows; cancellation voids them. Check-in against leave date returns 409 warning. Smoke test with `quickstart.md` step 5.

---

## Phase 6: User Story 4 — Attendance Reporting by Department & Period (Priority: P2)

**Goal**: Admins can request a department-level rollup report (`GET /api/staff-attendance/departments`) for any date range. Frontend `StaffAttendance.tsx` has a Reports tab rendering period and department views with date-range picker and department filter.

**Independent Test**: Seed multiple staff in two departments with mixed attendance. Call `GET /api/staff-attendance/departments?start_date=YYYY-MM-01&end_date=YYYY-MM-DD`. Verify one row per department with correct aggregates. Verify empty-department returns `[]` not error.

### Implementation for User Story 4

- [ ] T028 [US4] Add `AttendanceModel::getDepartmentReport()` method in `backend/app/Models/AttendanceModel.php` — single SQL aggregate GROUP BY `s.department` joining `staff` and `staff_attendance`; returns `department`, `staffCount`, `presentDays`, `absentDays`, `lateDays`, `onLeaveDays`, `totalOvertimeHours`, `attendanceRate`
- [ ] T029 [US4] Add `AttendanceController::departmentReport()` method in `backend/app/Controllers/Api/AttendanceController.php` — validates `start_date` + `end_date`; enforces `admin`/`super_admin` role; calls `AttendanceModel::getDepartmentReport()`; returns `{ period, departments: [] }` on empty result
- [ ] T030 [US4] Add `AttendanceDepartmentReport` and `AttendanceDepartmentSummary` TypeScript interfaces to `frontend/src/api/api.ts`
- [ ] T031 [US4] Add `api.getAttendanceDepartmentReport()` method in `frontend/src/api/api.ts` — calls `GET /staff-attendance/departments` with `start_date`, `end_date` query params
- [ ] T032 [P] [US4] Extend `useStaffAttendanceReport.ts` in `frontend/src/hooks/useStaffAttendanceReport.ts` — add `useAttendanceDepartmentReport(startDate, endDate)` React Query hook alongside existing period report hook
- [ ] T033 [P] [US4] Create `frontend/src/components/staff-attendance/AttendancePeriodReport.tsx` — component accepting `startDate`, `endDate`, `department?` props; renders date-range picker (shadcn `DateRangePicker`), department filter dropdown, per-staff aggregated results table with columns: Name, Dept, Present, Absent, Late, Leave, Early Dep, Hours, Overtime, Rate%; loading skeleton; empty state
- [ ] T034 [US4] Modify `frontend/src/pages/StaffAttendance.tsx` — add "Reports" tab to the existing tab group; render `AttendancePeriodReport` component inside; add `overtimeHours` column to the Attendance Records tab table; connect to `useStaffAttendanceReport` hook

**Checkpoint**: US4 fully functional. Department and period report endpoints work. Reports tab renders in frontend. Smoke test with `quickstart.md` steps 6 & 7.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, error guard hardening, linting, and curl test documentation.

- [ ] T035 [P] PHP lint check: run `php -l` on all modified/new PHP files (`StaffAttendanceService.php`, `AttendanceController.php`, `LeaveController.php`, `AttendanceModel.php`, `Routes.php`, migration file) — fix any parse errors
- [ ] T036 [P] TypeScript type-check: run `./node_modules/.bin/tsc --noEmit --pretty false` in `frontend/` — fix any type errors introduced by new interfaces or modified return types
- [ ] T037 [P] ESLint: run targeted `npx eslint src/api/api.ts src/hooks/useStaffAttendanceReport.ts src/components/staff-attendance/AttendancePeriodReport.tsx src/pages/StaffAttendance.tsx` in `frontend/` — fix errors (warnings acceptable)
- [ ] T038 Run full smoke test sequence from `quickstart.md` steps 2–9 against a running local dev server; document results in `quickstart.md` under a "Validation Results" section
- [ ] T039 Guard: verify `GET /api/staff-attendance/report` with no auth returns HTTP 401; verify with `bursar` role returns HTTP 403; document in `quickstart.md`
- [ ] T040 Guard: verify tenant isolation — staff-attendance rows from Tenant A do not appear in report for Tenant B; document in `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — can proceed after T003–T005
- **Phase 4 (US2)**: Depends on Phase 2 + US1 service complete (T006–T008) for `classifyStatus` and `calculateOvertimeHours`
- **Phase 5 (US3)**: Depends on Phase 2 — independent of US2; uses service stubs from T003
- **Phase 6 (US4)**: Depends on Phase 4 (period report model methods); independent of US3
- **Phase 7 (Polish)**: Depends on all implementation phases complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on US2/US3/US4
- **US2 (P1)**: Starts after Phase 2; reuses service methods from US1 (T006–T008) — best done after US1
- **US3 (P2)**: Starts after Phase 2; independent of US2/US4
- **US4 (P2)**: Starts after US2 model methods (T016) exist; independent of US3

### Within Each User Story

- Service methods before controller calls
- Controller methods before routes
- Backend routes before frontend API methods
- Frontend API methods before hooks
- Hooks before page/component wiring

### Parallel Opportunities

- **T004 + T005**: Model `allowedFields` update (PHP) and TS type addition — different files, run in parallel
- **T006 + T007 + T008**: Three service method implementations — same file, sequential
- **T009 + T013**: Controller refactor (PHP) and `api.ts` type update (TS) — different files, run in parallel once T006–T008 done
- **T015 + T016**: Two new model methods in same file — sequential
- **T019 + T021**: TS interface additions and hook creation — different files, run in parallel once T017 done
- **T028 + T032 + T033**: Department model method, department hook extension, and report component — different files, run in parallel
- **T035 + T036 + T037**: Lint checks — independent, run in parallel
- **T039 + T040**: Auth and isolation guards — independent curl tests, run in parallel

---

## Parallel Example: User Story 1

```bash
# After T006–T008 (service methods complete), these can run in parallel:
T009: Refactor AttendanceController::checkIn() — backend/app/Controllers/Api/AttendanceController.php
T013: Update api.ts types — frontend/src/api/api.ts
```

## Parallel Example: User Story 4

```bash
# After T016 (getPeriodReport model method), these can run in parallel:
T028: getDepartmentReport() — backend/app/Models/AttendanceModel.php
T032: useAttendanceDepartmentReport hook — frontend/src/hooks/useStaffAttendanceReport.ts
T033: AttendancePeriodReport.tsx component — frontend/src/components/staff-attendance/AttendancePeriodReport.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2 — P1 Stories)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T005)
3. Complete Phase 3: US1 (T006–T013)
4. Complete Phase 4: US2 (T014–T021)
5. **STOP and VALIDATE**: Smoke test steps 3, 4, 6, 7 from `quickstart.md`
6. Deploy/demo MVP — check-in/check-out with auto-classification, overtime tracking, period report

### Full Delivery (All Stories)

7. Complete Phase 5: US3 (T022–T027)
8. Complete Phase 6: US4 (T028–T034)
9. Complete Phase 7: Polish (T035–T040)
10. Each story is independently testable and additive

---

## Notes

- [P] tasks = different files, no blocking dependencies
- [Story] label maps each task to its user story for traceability
- New `Routes.php` entries for `staff-attendance/report` and `staff-attendance/departments` **must precede** the `staff-attendance/(:segment)` wildcard — see `contracts/staff-attendance-api.md`
- `source='leave_sync'` is the sentinel for safe leave void; never delete `source='manual'` rows in `voidLeaveAttendance()`
- When tenant has no `staffWorkHours` setting, fall back to `08:30`/`17:00`/`8.5h` — do not error
- Deactivated staff (`employment_status != 'active'`) must be blocked from new check-in writes (T009)
