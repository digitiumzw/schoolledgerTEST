# Tasks: Redo Staff Module & Kiosk Attendance Mode

**Input**: Design documents from `specs/006-staff-kiosk-attendance/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api-contracts.md ✅ · quickstart.md ✅

**Organization**: Tasks are grouped by user story. No automated test framework exists in the repo — no test tasks are generated.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P]-marked tasks in the same phase (different files, no dependencies)
- **[Story]**: Maps to user story from spec.md (US1–US5)
- Exact file paths are included in every task description

## Path Conventions (from plan.md)

- Backend: `backend/app/`
- Frontend: `frontend/src/`

---

## Phase 1: Setup

**Purpose**: Confirm branch and verify existing baseline before any changes.

- [x] T001 Confirm active branch is `006-staff-kiosk-attendance` (`git branch --show-current`)
- [x] T002 Run `cd backend && php spark migrate` to ensure all existing migrations are applied before adding new ones

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema changes that MUST land before any user story work begins. These affect tables shared by all stories.

**⚠️ CRITICAL**: No user story work can begin until both migrations are created, applied, and verified.

- [x] T003 Create migration `backend/app/Database/Migrations/2026-04-06-001_Add_source_to_staff_attendance.php` — add `source ENUM('manual','kiosk','system') DEFAULT 'manual'` column and `UNIQUE KEY uq_staff_date (tenant_id, staff_id, date)` constraint to `staff_attendance`; include `down()` that drops both
- [x] T004 Create migration `backend/app/Database/Migrations/2026-04-06-002_Fix_leave_type_enum.php` — UPDATE existing rows (`vacation`→`annual`, `personal`→`annual`), then ALTER `leave_requests.leave_type` ENUM to `('annual','sick','maternity','paternity','study','unpaid','compassionate')`; document irreversibility of data migration in class docblock
- [x] T005 Apply both new migrations: `cd backend && php spark migrate` and verify no errors

**Checkpoint**: `staff_attendance` has a `source` column + unique constraint. `leave_requests.leave_type` ENUM is updated.

---

## Phase 3: User Story 1 — Kiosk Check-In / Check-Out (Priority: P1) 🎯 MVP

**Goal**: Staff can sign in and out from a dedicated `/kiosk` page using their name selection + employee ID confirmation. All attendance records created via kiosk appear in the admin view.

**Independent Test**: Navigate to `/kiosk?tenant_id=<id>` (with kiosk mode enabled), select a staff member, enter their employee ID, tap Sign In, then verify the attendance record appears in the admin Attendance Records view with `source: kiosk`.

### Backend — Kiosk Controller

- [x] T006 [P] Create `backend/app/Controllers/Api/KioskController.php` extending `BaseApiController` with a `status()` method: validates `tenant_id` query param → looks up tenant → reads `kioskModeEnabled` from `tenants.settings` JSON → if disabled returns `{kioskEnabled: false, staff: []}` → if enabled queries `staff` WHERE `employment_status='active'` AND `employee_id IS NOT NULL` AND `tenant_id=?`, joins today's `staff_attendance` record (if any), maps to `{id, name, kioskState}` response per contracts/api-contracts.md
- [x] T007 Add `action()` method to `backend/app/Controllers/Api/KioskController.php`: validates required body fields (`tenant_id`, `staff_id`, `employee_id`, `action`) → verifies kiosk enabled → verifies staff is active and `employee_id` matches → calls upsert logic to create/update `staff_attendance` row with `source='kiosk'`, `check_in` or `check_out` timestamp, auto-sets `status` (`present`/`late` based on work start time) and computes `work_hours` on check-out → returns success response per contracts/api-contracts.md
- [x] T008 [P] Register public kiosk routes in `backend/app/Config/Routes.php` — add a route group for `/api/kiosk` **before** the JWT-filtered group: `GET /api/kiosk/status` → `KioskController::status` and `POST /api/kiosk/action` → `KioskController::action`
- [x] T009 [P] Add `/api/kiosk` path prefix to the JWTAuthFilter exclusion list in `backend/app/Config/Filters.php` so kiosk endpoints bypass JWT validation

### Frontend — Kiosk UI

- [x] T010 [P] Add `getKioskStatus(tenantId: string)` and `postKioskAction(tenantId, staffId, employeeId, action)` functions to `frontend/src/api/api.ts` using a separate Axios instance (no `Authorization` header); define response types inline
- [x] T011 [P] [US1] Create `frontend/src/components/kiosk/KioskStaffList.tsx` — renders a searchable list of staff from `GET /api/kiosk/status`; displays name + `kioskState` badge (`not_arrived` / `checked_in` / `completed`); calls `onSelect(staff)` prop when a staff row is clicked; shows "Kiosk mode is not enabled" when `kioskEnabled: false`; shows "No staff with employee IDs found — contact admin" when list is empty
- [x] T012 [P] [US1] Create `frontend/src/components/kiosk/KioskActionPanel.tsx` — displays selected staff name, the correct action button ("Sign In" / "Sign Out" based on `kioskState`), an employee ID input field with Zod validation (non-empty string), and a submit button; on submit calls `postKioskAction`; shows inline error messages for all API error codes (403 wrong ID, 403 not active, 400 already checked in, etc.); calls `onSuccess(result)` and `onBack()` props
- [x] T013 [P] [US1] Create `frontend/src/components/kiosk/KioskConfirmation.tsx` — displays staff name, action taken, timestamp, and attendance status; includes a 4-second countdown that auto-calls `onReset()` prop; includes a "Done" button for immediate reset; shows a success icon
- [x] T014 [US1] Create `frontend/src/pages/KioskPage.tsx` — reads `tenant_id` from `useSearchParams()`; manages view state machine (`'list' | 'action' | 'confirmation'`) and selected staff; renders `KioskStaffList` → `KioskActionPanel` → `KioskConfirmation` in sequence; uses a full-screen, centered layout with school name header (no sidebar, no nav); refetches staff list status after each confirmation reset
- [x] T015 [US1] Add `/kiosk` route to `frontend/src/App.tsx` outside any `<ProtectedRoute>` wrapper — render `<KioskPage />` with a minimal `<KioskLayout>` (full screen, no sidebar, no top nav bar)

**Checkpoint**: Navigating to `/kiosk?tenant_id=<id>` shows the staff list; a staff member can sign in and out; the attendance record appears in the admin view.

---

## Phase 4: User Story 2 — Admin Enables / Disables Kiosk Mode (Priority: P1)

**Goal**: Admin can toggle kiosk mode on/off from the Settings page. When on, the Settings page shows the kiosk URL. When off, the `/kiosk` page shows a disabled message.

**Independent Test**: Log in as admin → Settings → toggle "Enable Kiosk Mode" ON → save → navigate to the kiosk URL → verify the staff list appears. Toggle OFF → save → verify the kiosk URL shows "Kiosk mode is not enabled."

### Backend — Settings Extension

- [x] T016 [US2] Update `backend/app/Controllers/Api/SettingsController.php`: add `'kioskModeEnabled' => false` to `DEFAULT_SETTINGS`; add `kioskModeEnabled` to the `index()` response array; add `kioskModeEnabled` to the `$updatedSettings` merge in `update()` (cast to bool)

### Frontend — Settings UI

- [x] T017 [P] [US2] Update `frontend/src/api/api.ts` settings functions to include `kioskModeEnabled: boolean` in the settings update payload type
- [x] T018 [US2] Add a "Kiosk Mode" section to the settings page component (check `frontend/src/components/settings/` or the page that renders settings): a labelled toggle (admin-only, using React Hook Form + Zod) for `kioskModeEnabled`; when enabled, show a read-only "Kiosk URL" text field displaying `<origin>/kiosk?tenant_id=<tenantId>` with a "Copy URL" button; use `toast` on copy success

**Checkpoint**: Admin can toggle kiosk mode; saving persists the value; the kiosk URL is shown when enabled; kiosk page correctly gates on the enabled flag.

---

## Phase 5: User Story 3 — Admin Manages Staff Records (Priority: P2)

**Goal**: Staff records are managed correctly: hard-delete is blocked when attendance/leave records exist, and a helpful message is shown. Employee IDs are required for kiosk eligibility.

**Independent Test**: Create a staff member → add an attendance record → attempt to delete the staff member → verify a 409 error message appears with a suggestion to change employment status instead.

### Backend — Staff Delete Guard

- [x] T019 [US3] Update `backend/app/Controllers/Api/StaffController.php` `delete()` method: before executing DELETE, query `staff_attendance` and `leave_requests` for any rows with matching `staff_id` and `tenant_id`; if any rows exist, return HTTP 409 with message "Cannot delete staff member with existing attendance or leave records. Change their employment status to 'resigned' or 'retired' instead."

### Frontend — Staff Delete Error Handling

- [x] T020 [US3] Update the staff delete handler in `frontend/src/pages/Staff.tsx` (and `StaffProfilePage.tsx` if it has its own delete): catch 409 responses specifically and show a distinct error toast/message ("This staff member has attendance or leave records and cannot be deleted. Update their employment status to 'Resigned' or 'Retired' instead.") rather than a generic error

**Checkpoint**: Attempting to hard-delete a staff member with records shows a clear 409 message. Staff member without records can still be deleted.

---

## Phase 6: User Story 4 — Admin Records and Manages Attendance (Priority: P2)

**Goal**: Attendance records created via admin are duplicate-safe (upsert, not duplicate insert), work hours are calculated correctly, and the `source` column is set to `'manual'` for admin-created records.

**Independent Test**: Create a manual attendance record for today for a staff member → try to create another record for the same staff and date → verify the second save updates the existing record (no duplicate). Check-in 09:00, check-out 17:00 → verify `work_hours = 8.0`.

### Backend — Attendance Upsert & Source Fix

- [x] T021 [P] [US4] Update `backend/app/Controllers/Api/AttendanceController.php` `checkIn()` method: before INSERT, query for an existing `staff_attendance` row matching `(tenant_id, staff_id, date)`; if found, UPDATE the `check_in` time and `status` (recalculate late status) on the existing row; if not found, INSERT new row with `source='manual'`
- [x] T022 [P] [US4] Update `backend/app/Controllers/Api/AttendanceController.php` `checkOut()` method: query for existing row for `(tenant_id, staff_id, date)`; if found, UPDATE `check_out`, compute `work_hours = TIMEDIFF(check_out, check_in)` in decimal hours, validate that `check_out > check_in`; if no existing row found, return 400 "No check-in record found for this date"
- [x] T023 [US4] Update `backend/app/Controllers/Api/AttendanceController.php` `recordStaffAttendance()` (manual entry) method: use same upsert pattern; validate `check_out > check_in` when both are provided; set `source='manual'` on INSERT and preserve `source` on UPDATE

### Frontend — Attendance Mutation Fixes

- [x] T024 [US4] Update `frontend/src/hooks/useStaffAttendanceData.ts` mutation hooks (`useCheckInMutation`, `useCheckOutMutation`, `useUpdateAttendanceMutation`): ensure they call `queryClient.invalidateQueries` on the attendance query keys after success, so the records list and daily attendance tab re-fetch without a manual refresh

**Checkpoint**: Creating an attendance record, then creating another for the same staff/date results in one updated record. Work hours compute correctly. No duplicate rows.

---

## Phase 7: User Story 5 — Staff Leave Request Workflow (Priority: P3)

**Goal**: Leave type values are consistent between the DB, backend validation, and frontend dropdowns. New leave types (`annual`, `study`, `compassionate`) work end-to-end.

**Independent Test**: Create a leave request with type `annual` → verify it saves. Try `vacation` → verify it returns a validation error. Try `compassionate` → verify it saves.

### Backend — Leave Type Validation Fix

- [x] T025 [US5] Update `backend/app/Controllers/Api/LeaveController.php` `create()` and `update()` methods: replace any hardcoded leave type array with the new set `['annual','sick','maternity','paternity','study','unpaid','compassionate']`; return 400 with message "Invalid leave type. Allowed: annual, sick, maternity, paternity, study, unpaid, compassionate" for invalid values

### Frontend — Leave Type Alignment

- [x] T026 [P] [US5] Update `frontend/src/types/dashboard.ts` `LeaveRequest.leaveType` union to `'annual' | 'sick' | 'maternity' | 'paternity' | 'study' | 'unpaid' | 'compassionate'`
- [x] T027 [US5] Update all leave type `<select>` / dropdown options in `frontend/src/components/staff-attendance/LeaveManagementTab.tsx` (and any other forms that reference leave type) to use the new values and display labels: Annual Leave, Sick Leave, Maternity Leave, Paternity Leave, Study Leave, Unpaid Leave, Compassionate Leave

**Checkpoint**: Leave request form shows all 7 correct leave types. Old values (`vacation`, `personal`) are not present. New requests with `annual`, `study`, or `compassionate` save successfully.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, constitution compliance check, and minor UX consistency fixes.

- [x] T028 [P] Verify all new `KioskController.php` queries include `tenant_id` filtering (Principle I compliance check)
- [x] T029 [P] Verify the `source` column is populated correctly in all attendance-writing paths: `checkIn()`, `checkOut()`, `recordStaffAttendance()` (manual = `'manual'`), kiosk `action()` (kiosk = `'kiosk'`)
- [x] T030 Run full kiosk flow per `specs/006-staff-kiosk-attendance/quickstart.md` — enable kiosk in settings, open `/kiosk?tenant_id=<id>`, sign in a staff member, sign out, verify record in admin attendance view
- [x] T031 [P] Verify the settings page kiosk toggle is not visible or is read-only for non-admin roles (teacher, bursar) — check role guard in the settings UI component
- [x] T032 Verify the `/kiosk` route does not appear in the authenticated sidebar nav — confirm it is only reachable via the kiosk URL

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phase 3 (US1 — Kiosk Sign-In/Out)**: Depends on Phase 2 (needs `source` column + unique constraint)
- **Phase 4 (US2 — Admin Kiosk Toggle)**: Depends on Phase 2; can proceed in parallel with Phase 3
- **Phase 5 (US3 — Staff Delete Guard)**: Depends on Phase 2 only; can proceed in parallel with Phases 3 & 4
- **Phase 6 (US4 — Attendance Fixes)**: Depends on Phase 2 (needs `source` column); can proceed in parallel with Phases 3, 4, 5
- **Phase 7 (US5 — Leave Types)**: Depends on Phase 2 (needs leave_type migration); can proceed in parallel with all other story phases
- **Phase 8 (Polish)**: Depends on all story phases completing

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 done + US2 (kiosk enabled flag must exist in backend to test full flow) — implement US2 backend first (T016), then US1 is fully testable
- **US2 (P1)**: Fully independent after Phase 2
- **US3 (P2)**: Fully independent after Phase 2
- **US4 (P2)**: Fully independent after Phase 2
- **US5 (P3)**: Fully independent after Phase 2

### Within Each Phase

- [P]-marked tasks have no intra-phase dependencies and can execute simultaneously
- Non-[P] tasks within a phase depend on earlier [P] tasks in the same phase completing first
- Backend tasks within a story can complete before or after frontend tasks — both sides are independently testable via API client / browser

### Parallel Opportunities

**Phase 3 (US1)** — can parallelize:
- T006 (KioskController status) + T008 (Routes) + T009 (Filters) + T010 (API functions in api.ts) simultaneously
- T011 (KioskStaffList) + T012 (KioskActionPanel) + T013 (KioskConfirmation) simultaneously after T010
- T014 (KioskPage) depends on T011, T012, T013 completing

**Phase 4 (US2)** — T016 (backend) + T017 (API types) can run in parallel; T018 (settings UI) depends on T017

**Phase 6 (US4)** — T021 (checkIn upsert) + T022 (checkOut upsert) + T024 (cache invalidation) can run in parallel; T023 depends on T021+T022 pattern being established

**Phase 7 (US5)** — T026 (types) + T025 (backend validation) can run in parallel; T027 (dropdown UI) depends on T026

---

## Parallel Example: Phase 3 (US1 — Kiosk MVP)

```text
# Step 1 — run these in parallel (no dependencies on each other):
T006: Create KioskController::status() in backend/app/Controllers/Api/KioskController.php
T008: Register kiosk routes in backend/app/Config/Routes.php
T009: Add kiosk exclusion in backend/app/Config/Filters.php
T010: Add kiosk API functions to frontend/src/api/api.ts

# Step 2 — run these in parallel after T010:
T007: Add KioskController::action() to backend/app/Controllers/Api/KioskController.php
T011: Create KioskStaffList.tsx in frontend/src/components/kiosk/
T012: Create KioskActionPanel.tsx in frontend/src/components/kiosk/
T013: Create KioskConfirmation.tsx in frontend/src/components/kiosk/

# Step 3 — sequential (depends on T011, T012, T013):
T014: Create KioskPage.tsx in frontend/src/pages/

# Step 4 — sequential (depends on T014):
T015: Add /kiosk route to frontend/src/App.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2 Backend Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational migrations ← **CRITICAL GATE**
3. Complete T016 (US2 backend — `kioskModeEnabled` in settings) — US1 needs this to test
4. Complete Phase 3 (US1 — kiosk sign-in/out)
5. **STOP and VALIDATE**: Enable kiosk mode manually via API, open `/kiosk?tenant_id=<id>`, sign in/out a staff member
6. Complete Phase 4 (US2 — admin toggle UI)
7. **DEMO**: Full kiosk flow including admin toggle

### Incremental Delivery

1. Setup + Foundational → Schema ready
2. US2 backend (T016) + US1 (Phase 3) → Kiosk works end-to-end (MVP!)
3. US2 frontend (Phase 4) → Admin can enable/disable kiosk from UI
4. US3 (Phase 5) → Staff delete safety
5. US4 (Phase 6) → Attendance duplicates fixed
6. US5 (Phase 7) → Leave types aligned
7. Polish (Phase 8) → Final verification

### Parallel Team Strategy

With two developers after Phase 2 completes:

- **Dev A**: Phase 3 (US1 kiosk UI + backend) + Phase 4 (US2 settings toggle)
- **Dev B**: Phase 5 (US3 staff delete) + Phase 6 (US4 attendance fixes) + Phase 7 (US5 leave types)

---

## Notes

- `[P]` tasks = different files, no intra-phase dependencies
- `[Story]` label maps each task to its user story for traceability
- **Do not edit existing migrations** — all schema changes go into the two new migration files (T003, T004)
- The `/api/kiosk/*` public endpoint exception is documented in `plan.md` Complexity Tracking — this is intentional and approved
- Kiosk endpoints in `KioskController.php` must validate `tenant_id` from the request body/query against the DB (not from JWT — there is none for these routes)
- Commit after each checkpoint to preserve incremental progress
