# Tasks: Fix Frontend Bugs and Replace MockApi

**Input**: Design documents from `specs/013-fix-frontend-api/`  
**Branch**: `013-fix-frontend-api`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent delivery. US1 and US2 can proceed immediately (only existing api.ts methods needed). US3 requires the Foundational phase (new backend endpoints + api.ts additions).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all task descriptions

## Path Conventions

- **Backend**: `backend/app/Controllers/Api/`, `backend/app/Config/`
- **Frontend**: `frontend/src/api/`, `frontend/src/pages/`, `frontend/src/components/modals/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm scope and validate current error state before making changes.

- [x] T001 Confirm `frontend/src/api/mockApi.ts` does not exist (verify no mockApi module on disk — confirms all 11 import errors are broken imports, not a stale file)
- [x] T002 Run `grep -rn "mockApi" frontend/src/` to capture the full list of files and lines that need changing — use as the definitive checklist for Phases 3–5

---

## Phase 2: Foundational (Blocking Prerequisites for US3)

**Purpose**: Add missing backend endpoints and api.ts methods that US3 modals depend on. US1 and US2 can begin in parallel with this phase since they only use already-existing api methods.

**⚠️ CRITICAL**: All US3 modal work (Phase 5) depends on this phase completing first.

- [x] T003 Add `recordStaffAttendance` method to the STAFF ATTENDANCE section in `frontend/src/api/api.ts` — calls `POST /api/staff-attendance` with body `{staffId, date, checkIn?, checkOut?, status, remarks?, workHours?}` and returns `response.data`

- [x] T004 Add 5 new public methods to `backend/app/Controllers/Api/TransportController.php`:
  - `getStudentsWithRouteStatus($routeId)` — query all active students, cross-reference `transport_assignments` to return `[{id, firstName, lastName, className, routeStatus, assignedRouteName}]`
  - `getAssignmentsWithDetails($routeId)` — query `transport_assignments` joined with students and routes, filter by optional `month` query param, return assignment detail array
  - `recordPayment()` — create record in `payments` table from `{studentId, routeId, month, amount, method, notes}`; filter by tenant_id; return `{id}`
  - `assignWithCharges($routeId)` — assign students + generate monthly charge records for `startDate` to `endDate` range; return `{createdAssignments, createdCharges, totalAmount}`
  - `previewCharges($routeId)` — compute (without saving) monthly charges for date range using route's `monthly_fee`; return `{routeFee, durationMonths, totalAmount, startDate, endDate, charges: [{month, amount, isProrated}]}`
  - All methods: start with `$tenantId = $this->getTenantId()`, require `admin` or `super_admin` role, filter all queries by `tenant_id`

- [x] T005 Register 5 new routes in `backend/app/Config/Routes.php` inside the existing `api` group, adjacent to existing transport routes (after line 198):
  ```php
  $routes->get('transport/routes/(:segment)/students-with-status', 'TransportController::getStudentsWithRouteStatus/$1');
  $routes->get('transport/routes/(:segment)/assignments', 'TransportController::getAssignmentsWithDetails/$1');
  $routes->post('transport/payment', 'TransportController::recordPayment');
  $routes->post('transport/routes/(:segment)/assign-with-charges', 'TransportController::assignWithCharges/$1');
  $routes->post('transport/routes/(:segment)/preview-charges', 'TransportController::previewCharges/$1');
  ```

- [x] T006 Add the 5 corresponding api.ts methods to the TRANSPORT section in `frontend/src/api/api.ts` (after the existing transport methods):
  - `getStudentsWithRouteStatus(routeId, term?)` → `GET /transport/routes/:routeId/students-with-status`
  - `getTransportAssignmentsWithDetails(routeId, month?)` → `GET /transport/routes/:routeId/assignments`
  - `recordTransportPayment(data)` → `POST /transport/payment`
  - `assignStudentsWithCharges(data)` → `POST /transport/routes/:routeId/assign-with-charges`
  - `previewTransportCharges(data)` → `POST /transport/routes/:routeId/preview-charges`
  - All methods follow the same `apiRequest` + `return response.data` pattern as existing methods

**Checkpoint**: Foundation ready. T003–T006 complete. US3 modal work can begin. Verify backend server restarts cleanly after adding routes.

---

## Phase 3: User Story 1 — Dashboard Loads Real Data (Priority: P1) 🎯 MVP

**Goal**: Admin and teacher dashboard pages load real data from the backend without any import errors or runtime crashes.

**Independent Test**: Log in as admin → Dashboard shows real stats, recent payments, pending leaves. Log in as teacher → Dashboard shows classes and attendance summary. Zero console errors.

- [x] T007 [US1] Replace `import { mockApi } from "@/api/mockApi"` with `import { api } from "@/api/api"` in `frontend/src/pages/Dashboard.tsx` and fix the admin dashboard data-fetch function `fetchDashboardData` to call `api.getDashboardStats()`, `api.getRecentPayments(5)`, and `api.getPendingLeaveRequests()` instead of their mockApi equivalents

- [x] T008 [US1] In `frontend/src/pages/Dashboard.tsx`, fix the `TeacherDashboard` component:
  - `loadClasses`: replace `mockApi.getClasses()` → `api.getClasses()`
  - `loadClassStudents`: replace `mockApi.getStudentsByClassId(selectedClassId)` → `api.getStudentsByClass(selectedClassId)`
  - `loadClassAnalytics`: replace `mockApi.getClassAttendanceSummary(classId, start, end)` with a call to `api.getStudentAttendance({ classId: selectedClassId })` and compute the summary client-side by filtering records to the `[startDate, endDate]` range and aggregating `present/absent/late` counts per student (same pattern as `fetchAttendanceSummary` in `Attendance.tsx` lines 125–258)

**Checkpoint**: Dashboard fully functional for both admin and teacher roles using real backend data.

---

## Phase 4: User Story 2 — Student Attendance Page Works End-to-End (Priority: P1)

**Goal**: The Attendance page loads classes, students, and existing attendance records from the backend, and saves new records to the backend.

**Independent Test**: Log in as teacher → navigate to Attendance → select class → student list appears → mark attendance → save → refresh page → same status is still shown.

- [x] T009 [US2] Replace `import { mockApi } from "@/api/mockApi"` with `import { api } from "@/api/api"` in `frontend/src/pages/Attendance.tsx`

- [x] T010 [US2] In `frontend/src/pages/Attendance.tsx`, fix `loadTeacherClasses`: replace `mockApi.getClasses()` → `api.getClasses()`

- [x] T011 [US2] In `frontend/src/pages/Attendance.tsx`, fix `loadClassStudents`: replace `mockApi.getStudentsByClassId(selectedClassId)` → `api.getStudentsByClass(selectedClassId)`

- [x] T012 [US2] In `frontend/src/pages/Attendance.tsx`, fix `loadExistingAttendance`: replace `mockApi.getAttendanceByClassAndDate(selectedClassId, dateString)` → `api.getStudentAttendance({ classId: selectedClassId, date: dateString })`; the returned records array is used the same way — map `record.studentId → record.status`

- [x] T013 [US2] In `frontend/src/pages/Attendance.tsx`, fix `fetchAttendanceSummary`: replace `mockApi.getStudentAttendance({ classId: selectedClassId, recordedBy? })` → `api.getStudentAttendance({ classId: selectedClassId, ...(recordedByFilter ? { recordedBy: recordedByFilter } : {}) })`; the rest of the function (filtering, aggregation, summary computation) remains unchanged

- [x] T014 [US2] In `frontend/src/pages/Attendance.tsx`, fix `handleSaveAttendance`: replace `mockApi.saveAttendanceRecords(records, user!.id)` → `api.saveStudentAttendance(records)`; drop the `user!.id` argument — the backend derives `recordedBy` from the JWT

**Checkpoint**: Attendance page fully functional — classes load, students appear, existing records pre-fill, saving persists to backend.

---

## Phase 5: User Story 3 — All Modal Actions Use Real API (Priority: P2)

**Goal**: All 9 affected modals send their actions to the real backend. No modal silently discards data or crashes.

**Independent Test**: Open each modal, perform its primary action, close it, and verify the change persists after a full page refresh.

### Simple remapping modals (existing api.ts methods — all parallel)

- [x] T015 [P] [US3] Fix `frontend/src/components/modals/ManualAttendanceModal.tsx`:
  - Replace import: `mockApi` → `api` from `@/api/api`
  - `mockApi.getStaff()` → `api.getStaff()`
  - `mockApi.updateStaffAttendance(record.id, {...})` → `api.updateStaffAttendance(record.id, {...})`
  - `mockApi.recordStaffAttendance({...})` → `api.recordStaffAttendance({...})` (added in T003)

- [x] T016 [P] [US3] Fix `frontend/src/components/modals/StaffFormModal.tsx`:
  - Replace import: `mockApi` → `api` from `@/api/api`
  - `mockApi.updateStaff(staff.id, staffData)` → `api.updateStaff(staff.id, staffData)`
  - `mockApi.createStaff(staffData)` → `api.createStaff(staffData)`

- [x] T017 [P] [US3] Fix `frontend/src/components/modals/ReviewLeaveModal.tsx`:
  - Replace import: `mockApi` → `api` from `@/api/api`
  - `mockApi.getStaff()` → `api.getStaff()`
  - `mockApi.reviewLeaveRequest(leave.id, status, 'admin1', reviewNotes)` → `api.reviewLeaveRequest(leave.id, status, 'admin1', reviewNotes)`

- [x] T018 [P] [US3] Fix `frontend/src/components/modals/EditLeaveRequestModal.tsx`:
  - Replace import: `mockApi` → `api` from `@/api/api`
  - `mockApi.getCalendar().then(...)` → `api.getCalendar().then(...)`
  - `mockApi.updateLeaveRequest(leave!.id, {...})` → `api.updateLeaveRequest(leave!.id, {...})`

- [x] T019 [P] [US3] Fix `frontend/src/components/modals/DeleteClassModal.tsx`:
  - Replace import: `mockApi` → `api` from `@/api/api`
  - `mockApi.deleteClass(classData.id)` → `api.archiveClass(classData.id)` (backend `DELETE /classes/:id` routes to `ClassController::archive`)

- [x] T020 [P] [US3] Fix `frontend/src/components/modals/DeleteRouteModal.tsx`:
  - Replace import: `mockApi` → `api` from `@/api/api`
  - `mockApi.deleteRoute(route.id)` → `api.deleteRoute(route.id)`

### Transport modals requiring new endpoints (depend on T004–T006)

- [x] T021 [US3] Fix `frontend/src/components/modals/AssignStudentsToRouteModal.tsx`:
  - Replace import: keep `api` import (already present), remove `mockApi` import
  - `mockApi.getStudentsWithRouteStatus(route.id, currentTerm)` → `api.getStudentsWithRouteStatus(route.id, currentTerm)` (added in T006)
  - Note: `api.previewTransportCharges` and `api.assignStudentsWithCharges` are already called correctly; they just need T006 to exist

- [x] T022 [US3] Fix `frontend/src/components/modals/TransportAssignmentStatusModal.tsx`:
  - Replace import: `mockApi` → `api` from `@/api/api`
  - `mockApi.getTransportAssignmentsWithDetails(route.id)` → `api.getTransportAssignmentsWithDetails(route.id)` (added in T006)
  - `mockApi.recordTransportPayment(paymentData)` → `api.recordTransportPayment(paymentData)` (added in T006)

- [x] T023 [US3] Fix `frontend/src/components/modals/TransportReportModal.tsx`:
  - Replace import: `mockApi` → `api` from `@/api/api`
  - `mockApi.getRoutes()` → `api.getRoutes()`
  - `mockApi.getTransportAssignmentsWithDetails(routeId, currentTerm)` → `api.getTransportAssignmentsWithDetails(routeId, currentTerm)` (added in T006; `currentTerm` maps to `month` param)

**Checkpoint**: All 9 modals fully functional. Every action persists to the backend database.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup.

- [x] T024 Run `grep -rn "mockApi" frontend/src/ --include="*.ts" --include="*.tsx"` and confirm zero results — if any remain, fix them before proceeding

- [x] T025 [P] Run `cd frontend && npx tsc --noEmit` and resolve any TypeScript errors introduced by the signature changes (e.g., `saveStudentAttendance` payload shape, method return types)

- [ ] T026 [P] Manually verify US1 end-to-end: log in as `admin@greenwood.co.zw` / `1234`, confirm Dashboard loads real stats, recent payments, and pending leaves without console errors; switch to a teacher account and confirm teacher dashboard shows classes and attendance summary

- [ ] T027 [P] Manually verify US2 end-to-end: navigate to Attendance, select a class, confirm students load, mark attendance for several students, save, refresh, confirm status persists

- [ ] T028 [P] Manually verify US3 end-to-end: open StaffFormModal (create + edit), ReviewLeaveModal, EditLeaveRequestModal, ManualAttendanceModal (create + update), DeleteClassModal, DeleteRouteModal, AssignStudentsToRouteModal, TransportAssignmentStatusModal, TransportReportModal — confirm each performs its action against the backend

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS Phase 5 (US3)
- **US1 (Phase 3)**: Depends on Phase 1 only — can start in parallel with Phase 2
- **US2 (Phase 4)**: Depends on Phase 1 only — can start in parallel with Phases 2 and 3
- **US3 (Phase 5)**: Depends on Phase 2 (Foundational) — begin after T003–T006 complete
- **Polish (Phase 6)**: Depends on Phases 3, 4, and 5 all complete

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Phase 1 — zero blocking prerequisites beyond existing api.ts
- **US2 (P1)**: Can start immediately after Phase 1 — zero blocking prerequisites beyond existing api.ts
- **US3 (P2)**: Depends on Foundational (T003–T006) for transport modals; simple-remap modals (T015–T020) can start in parallel with Foundational

### Within Each User Story

- US1: T007 and T008 are sequential (same file); T008 depends on T007's import fix
- US2: T009 → T010 → T011 → T012 → T013 → T014 are sequential (same file)
- US3: T015–T020 are fully parallel (different files); T021–T023 parallel with each other but depend on T004–T006

### Parallel Opportunities

| Parallelizable Group | Tasks | Notes |
|---|---|---|
| US1 + Foundation | T003–T008 | Different files entirely |
| US2 + US1 + Foundation | T003–T014 | All in different files |
| Simple remap modals | T015–T020 | Six different files |
| Transport modals | T021–T023 | Three different files, after T004–T006 |
| Polish verifications | T025–T028 | After all prior phases |

---

## Parallel Example: Foundational + US1 + US2

```text
# Immediately after Phase 1:

Track A (Foundational): T003 → T004 → T005 → T006
Track B (US1):          T007 → T008
Track C (US2):          T009 → T010 → T011 → T012 → T013 → T014

# After Track A + B + C complete:

Track D (US3 simple):   T015, T016, T017, T018, T019, T020 (all parallel)
Track E (US3 transport):T021, T022, T023 (after Track A done)

# After all tracks:
Polish:                  T024 → T025, T026, T027, T028
```

---

## Implementation Strategy

### MVP First (US1 Only — Dashboard Fix)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 3: US1 — Dashboard (T007–T008)
3. **STOP and VALIDATE**: Dashboard works for admin and teacher
4. If all good, continue

### Incremental Delivery

1. Phase 1 → Phase 3 (US1 Dashboard): Admin + teacher dashboard working ✅
2. Phase 4 (US2 Attendance): Full attendance workflow working ✅
3. Phase 2 (Foundational): New api.ts methods + backend endpoints ✅
4. Phase 5 (US3 Modals): All 9 modals working ✅
5. Phase 6 (Polish): Zero mockApi references, TypeScript clean ✅

### Single Developer Strategy

1. T001, T002 (setup — 5 min)
2. T007, T008 (Dashboard — 15 min)
3. T009–T014 (Attendance — 20 min)
4. T003 (api.ts recordStaffAttendance — 5 min)
5. T004 (backend transport methods — 30–45 min, most complex task)
6. T005 (backend route registration — 5 min)
7. T006 (api.ts transport methods — 10 min)
8. T015–T020 (simple modals — 20 min, all parallel-eligible)
9. T021–T023 (transport modals — 10 min)
10. T024–T028 (verification — 15 min)

---

## Notes

- [P] tasks = different files, no shared dependencies — safe to run concurrently
- US1 and US2 require **zero backend changes** — can be delivered immediately
- T004 is the most complex task: 5 new PHP methods, each must filter by `tenant_id`
- `saveStudentAttendance` (US2): drop the `userId` second argument — backend derives `recorded_by` from JWT
- `deleteClass` → `archiveClass`: the backend `DELETE /classes/:id` is a soft-archive, not permanent delete; modal behavior is correct
- After T024 (grep check), if any mockApi references remain in other files not covered by T007–T023, fix them in the same polish phase
