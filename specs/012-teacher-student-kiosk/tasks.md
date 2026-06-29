# Tasks: Teacher Student Attendance Kiosk

**Input**: Design documents from `/specs/012-teacher-student-kiosk/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)

---

## Phase 1: Setup (No new infrastructure needed)

**Purpose**: The core kiosk flow is already implemented. Phase 1 is a verification pass confirming what exists before gap work begins.

- [ ] T001 Verify `/kiosk/:code/students` route loads `StudentKioskPage` in `frontend/src/App.tsx`
- [ ] T002 Verify all 4 backend routes registered in `backend/app/Config/Routes.php` (status, validate-teacher, class-students, submit)
- [ ] T003 Verify `studentKioskApi` export exists in `frontend/src/api/api.ts` with all 4 methods

**Checkpoint**: Existing implementation confirmed — gap work can begin in parallel

---

## Phase 2: Foundational — Student Kiosk Mode Flag (Blocking)

**Purpose**: The `StudentKioskController` currently reads the **staff** flag `kioskModeEnabled` — this bug blocks all stories from working correctly in isolation.

**⚠️ CRITICAL**: Fix this before any user story testing or the enable/disable gate is broken

- [ ] T004 Fix `StudentKioskController::status()` to read `settings['studentKioskModeEnabled']` instead of `settings['kioskModeEnabled']` in `backend/app/Controllers/Api/StudentKioskController.php`
- [ ] T005 Fix `StudentKioskController::validateTeacher()` to read `settings['studentKioskModeEnabled']` in `backend/app/Controllers/Api/StudentKioskController.php`
- [ ] T006 Fix `StudentKioskController::classStudents()` to read `settings['studentKioskModeEnabled']` in `backend/app/Controllers/Api/StudentKioskController.php`
- [ ] T007 Fix `StudentKioskController::submit()` to read `settings['studentKioskModeEnabled']` in `backend/app/Controllers/Api/StudentKioskController.php`

**Checkpoint**: Kiosk flag correctly isolated from staff kiosk — all story work can now begin

---

## Phase 3: User Story 2 — Admin Enables / Disables Student Kiosk Mode (Priority: P1) 🎯 MVP

**Goal**: Admin can independently toggle the student kiosk on/off from Settings; the kiosk URL responds immediately.

**Independent Test**: Toggle student kiosk OFF in Settings → navigate to `/kiosk/{code}/students` → confirm "Kiosk not active" shown. Toggle ON → confirm kiosk loads normally. Staff kiosk unaffected throughout.

- [ ] T008 [US2] Add `studentKioskModeEnabled?: boolean` to `Settings` interface in `frontend/src/types/dashboard.ts`
- [ ] T009 [US2] Add student kiosk toggle card to `frontend/src/components/settings/GeneralSettingsTab.tsx` (below staff kiosk card; binds to `settings.studentKioskModeEnabled`)
- [ ] T010 [US2] Add student kiosk URL display block in `frontend/src/components/settings/GeneralSettingsTab.tsx` (shows `{origin}/kiosk/{settings.kioskCode}/students` with Copy button when `studentKioskModeEnabled` is true)
- [ ] T011 [US2] Verify `SettingsController` in `backend/app/Controllers/Api/SettingsController.php` persists and returns `studentKioskModeEnabled` as a JSON key in `tenants.settings` (no schema migration needed — JSON blob)

**Checkpoint**: Admin can gate the student kiosk independently of the staff kiosk

---

## Phase 4: User Story 1 — Teacher Takes Attendance for a Class (Priority: P1) 🎯 MVP

**Goal**: Teacher opens kiosk, enters Employee ID, selects class, marks each student, submits — records appear in admin view with correct `recorded_by`.

**Independent Test**: Open `/kiosk/{code}/students`, enter a valid teaching staff Employee ID, select a class, mark all students, submit → verify records in admin attendance with correct teacher Employee ID, date, class, and status. Confirm kiosk resets to idle after confirmation.

**Note**: `StudentKioskIdEntry`, `StudentKioskClassList`, `StudentKioskAttendance`, `StudentKioskConfirmation`, and `StudentKioskPage` are already complete. Tasks here validate and wire the remaining edge cases only.

- [ ] T012 [US1] Verify `StudentKioskIdEntry` shows inline error (not full-page) on invalid Employee ID without clearing marked data in `frontend/src/components/kiosk/StudentKioskIdEntry.tsx`
- [ ] T013 [US1] Verify `StudentKioskClassList` shows empty-state message when teacher has no assigned classes in `frontend/src/components/kiosk/StudentKioskClassList.tsx`
- [ ] T014 [US1] Verify `StudentKioskAttendance` shows empty-state message when a class has no enrolled students in `frontend/src/components/kiosk/StudentKioskAttendance.tsx`
- [ ] T015 [US1] Verify `StudentKioskConfirmation` auto-returns to idle after 10 seconds in `frontend/src/components/kiosk/StudentKioskConfirmation.tsx`
- [ ] T016 [US1] Verify `StudentKioskController::submit()` returns a clear 403 JSON error if kiosk is disabled between class selection and submit (mid-session disable) in `backend/app/Controllers/Api/StudentKioskController.php`

**Checkpoint**: Full teacher attendance flow works end-to-end, edge cases handled

---

## Phase 5: User Story 4 — Pre-Populated Marks for Already-Submitted Sessions (Priority: P2)

**Goal**: Reopening a class that already has today's attendance shows existing marks pre-filled; re-submitting updates records, no duplicates created.

**Independent Test**: Submit attendance for a class. Reopen that class on the kiosk same day. Verify all previously submitted statuses are pre-selected. Change 2 students and re-submit. Verify exactly those 2 records updated, no new rows inserted, `recorded_by` updated to new Employee ID.

**Note**: Backend upsert logic and `currentStatus` pre-fill are already implemented. Tasks validate correctness only.

- [ ] T017 [US4] Verify `classStudents` response includes correct `currentStatus` values from today's `student_attendance` records via manual API test against `GET /api/kiosk/student-attendance/class-students/{code}?employee_id=...&class_id=...`
- [ ] T018 [US4] Verify `StudentKioskAttendance` component pre-selects each student's status button when `currentStatus` is non-null in `frontend/src/components/kiosk/StudentKioskAttendance.tsx`
- [ ] T019 [US4] Verify `StudentKioskController::submit()` upsert path updates existing row (not inserts duplicate) by checking DB row count before and after re-submission in `backend/app/Controllers/Api/StudentKioskController.php`
- [ ] T020 [US4] Verify `StudentKioskClassList` shows `attendanceRecorded: true` badge on classes with today's attendance in `frontend/src/components/kiosk/StudentKioskClassList.tsx`

**Checkpoint**: Re-submission flow correct, no duplicate records possible

---

## Phase 6: User Story 3 — Admin Reviews Kiosk Attendance Records (Priority: P2)

**Goal**: Admin can filter attendance records by teacher Employee ID and see `recorded_by` on each record.

**Independent Test**: Submit kiosk attendance as teacher `EMP0042`. Open admin attendance view, filter by `EMP0042`. Confirm only that teacher's records are returned. Edit one record's status and confirm `recorded_by` is unchanged.

- [ ] T021 [P] [US3] Add `recordedBy` query param filter to `AttendanceController::studentIndex()` in `backend/app/Controllers/Api/AttendanceController.php`
- [ ] T022 [P] [US3] Add `recordedBy` column to the student attendance table in `frontend/src/pages/Attendance.tsx`
- [ ] T023 [US3] Add "Recorded By" filter input to student attendance filter bar in `frontend/src/pages/Attendance.tsx` (passes `recordedBy` param to `api.getStudentAttendance`)
- [ ] T024 [US3] Verify admin edit of a kiosk record does not overwrite `recorded_by` field in `backend/app/Controllers/Api/AttendanceController.php`

**Checkpoint**: All 4 user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Validate kiosk URL in Settings shows correct student kiosk URL after save in `frontend/src/components/settings/GeneralSettingsTab.tsx`
- [ ] T026 [P] Confirm `resolveTenant()` returns null (not 500) for unknown kiosk codes in `backend/app/Controllers/Api/StudentKioskController.php`
- [ ] T027 Run full quickstart.md walkthrough end-to-end and verify all 5 remaining tasks from `specs/012-teacher-student-kiosk/quickstart.md` are resolved

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Verify): No dependencies — start immediately
- **Phase 2** (Bug fix): Depends on Phase 1 — **blocks all story testing**
- **Phase 3** (US2 settings): Depends on Phase 2
- **Phase 4** (US1 kiosk flow): Depends on Phase 2; can run in parallel with Phase 3
- **Phase 5** (US4 pre-fill): Depends on Phase 4
- **Phase 6** (US3 admin): Depends on Phase 2; can run in parallel with Phases 3–5
- **Phase 7** (Polish): Depends on all story phases

### Parallel Opportunities

After Phase 2 completes:
- Phase 3 (US2) + Phase 4 (US1) + Phase 6 (US3) can all run in parallel
- Within Phase 6: T021 (backend) and T022 (frontend column) are parallel

---

## Implementation Strategy

### MVP (Phases 1–4 only)

1. Phase 1: Verify existing implementation
2. Phase 2: Fix `studentKioskModeEnabled` flag bug ← **critical**
3. Phase 3: Add Settings toggle for student kiosk
4. Phase 4: Validate teacher attendance flow edge cases
5. **STOP and TEST**: Full teacher attendance session works; admin can see records

### Full Delivery

Add Phase 5 (pre-fill validation) → Phase 6 (admin filter) → Phase 7 (polish)

---

## Notes

- T004–T007 are the same file; apply all four fixes in one edit
- T008–T010 are sequential (type → component data bind → URL display)
- T021 and T022 touch different files — safe to parallelize
- No DB migrations required for any task in this list
