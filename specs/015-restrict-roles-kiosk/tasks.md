# Tasks: Restrict Tenant Roles and Kiosk-Only Access

**Input**: Design documents from `/specs/015-restrict-roles-kiosk/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api-endpoints.md ✅ · quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

- **Backend**: `backend/app/`
- **Frontend**: `frontend/src/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared role constant that all controllers and all user stories depend on. Must complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Update `VALID_ROLES` constant from `['super_admin','admin','teacher','bursar','driver']` to `['super_admin','admin','bursar']` in `backend/app/Controllers/Api/BaseApiController.php`
- [X] T002 [P] Update the local `VALID_ROLES` reference (line ~136) in `backend/app/Controllers/Api/AuthController.php` to match — allowed values `['super_admin','admin','bursar']`

**Checkpoint**: All role validation now rejects `teacher` and `driver` across every controller that uses the constant.

---

## Phase 3: User Story 1 — Enforce Tenant Account Limits (Priority: P1) 🎯 MVP

**Goal**: Tenant accounts are restricted to Administrator and Bursar roles only, capped at five per tenant. Existing teacher/driver accounts are deactivated and can no longer log in.

**Independent Test**: Attempt to create a `teacher`-role account via `POST /api/users` — expect `400`. Create 5 accounts, then attempt a 6th — expect a clear rejection. Log in with a former teacher credential — expect blocked. See `quickstart.md` Part 1.

### Implementation

- [X] T003 [US1] In `UserController::create()` in `backend/app/Controllers/Api/UserController.php`: (a) after the existing role validation, add a check that rejects any role other than `admin`/`bursar` when the caller is not `super_admin`; (b) add a count query for active tenant accounts (roles `admin` + `bursar`) and return `400` with message `"Tenant account limit reached (maximum 5)"` if count ≥ 5
- [X] T004 [US1] Create migration file `backend/app/Database/Migrations/2026-04-07-110000_Deactivate_teacher_driver_accounts.php` with `up()` that runs `UPDATE users SET status = 'inactive' WHERE role IN ('teacher', 'driver')` and a `down()` that is a documented no-op (irreversible)
- [X] T005 [P] [US1] Remove `teacher` and `driver` options from any role `<select>` or `<option>` in the user creation/edit form in `frontend/src/pages/Settings.tsx`
- [X] T006 [P] [US1] In `frontend/src/App.tsx`: (a) remove the `/driver` route block and `DriverDashboard` import; (b) remove `'teacher'` from the `/attendance` route `allowedRoles`; (c) remove the teacher redirect case from `getDefaultRoute()`
- [ ] T007 [US1] Run `php spark migrate` in `backend/` to apply T004 migration and deactivate teacher/driver accounts

**Checkpoint**: US1 is fully testable independently. Role restriction and account cap are enforced at the API layer. Teacher and driver login is blocked.

---

## Phase 4: User Story 2 — Driver Kiosk Access to My Routes (Priority: P2)

**Goal**: Drivers authenticate at a public kiosk page using only their Employee ID and view their assigned routes and student roster. No login account required.

**Independent Test**: Navigate to `/kiosk/driver/<kiosk_code>` in the browser. Enter a valid driver Employee ID — see route list. Select a route — see student roster. Wait 2 minutes — page resets to Employee ID screen. Enter invalid ID — see error. See `quickstart.md` Part 2.

### Implementation

- [X] T008 [US2] Create migration file `backend/app/Database/Migrations/2026-04-07-100000_Add_driver_staff_id_to_transport_routes.php` with `up()` that adds column `driver_staff_id VARCHAR(36) NULL AFTER driver_user_id` to `transport_routes` and `down()` that drops it
- [ ] T009 [US2] Run `php spark migrate` in `backend/` to apply T008 migration and add the `driver_staff_id` column
- [X] T010 [US2] Create `backend/app/Controllers/Api/DriverKioskController.php` extending `BaseApiController` with: (a) `resolveTenant()` private helper (copy from `StudentKioskController`); (b) `validate()` method for `POST /api/kiosk/driver/validate` — parses `kiosk_code` + `employee_id`, resolves tenant, validates active staff member, queries `transport_routes` where `driver_staff_id = staff.id AND tenant_id = ?`, returns `driverName`, `employeeId`, `routes[]`; unified 403 for any failure (no enumeration)
- [X] T011 [US2] Add `roster()` method to `backend/app/Controllers/Api/DriverKioskController.php` for `GET /api/kiosk/driver/routes/:code` — parses `employee_id` and `route_id` from query params, re-validates staff, verifies `transport_routes.driver_staff_id = staff.id` for the requested route, queries `transport_assignments` (active, tenant-scoped) joined with `students`, returns route details + student roster
- [X] T012 [US2] Register two new public routes **before** the JWT-protected group in `backend/app/Config/Routes.php`: `$routes->post('kiosk/driver/validate', 'DriverKioskController::validate')` and `$routes->get('kiosk/driver/routes/(:any)', 'DriverKioskController::roster/$1')`
- [X] T013 [US2] Add `kioskDriverApi` object to `frontend/src/api/api.ts` with two functions: `validate(kioskCode, employeeId)` calling `POST /api/kiosk/driver/validate` and `getRoster(kioskCode, employeeId, routeId)` calling `GET /api/kiosk/driver/routes/:code?employee_id=&route_id=`
- [X] T014 [US2] Create `frontend/src/pages/DriverKioskPage.tsx` mirroring `StudentKioskPage.tsx` structure with four views: (a) **idle** — Employee ID input form + school name header; (b) **routes** — list of assigned routes from `kioskDriverApi.validate()`; (c) **roster** — student list for a selected route from `kioskDriverApi.getRoster()`; (d) **idle timeout** — reset to idle after 2 minutes of no interaction using `useEffect` + `setTimeout`
- [X] T015 [US2] Register the driver kiosk as a **public route** (no `<ProtectedRoute>`) in `frontend/src/App.tsx` at path `/kiosk/driver/:code`, alongside the existing kiosk routes

**Checkpoint**: US2 is fully testable independently. A driver with a linked staff record and `driver_staff_id` set on their route can authenticate and view their roster at the kiosk URL.

---

## Phase 5: User Story 3 — Teacher Kiosk Access for Attendance (Priority: P3)

**Goal**: Teachers continue to mark attendance via the existing student-attendance kiosk (`/kiosk/student-attendance/:code`) using their Employee ID. No new implementation is needed — the kiosk was built in specs/011. This phase confirms the existing flow is unbroken after account deactivation and login-path cleanup.

**Independent Test**: Navigate to the student-attendance kiosk URL. Enter a teacher's Employee ID — attendance marking should work exactly as before. Former teacher login credentials should be blocked at `POST /api/auth/login`. See `quickstart.md` Part 3.

### Implementation

- [X] T016 [US3] In `frontend/src/App.tsx`, confirm `'teacher'` has been removed from the `/attendance` route `allowedRoles` (verify T006 is complete) — if not already done, remove it now so the `/attendance` admin page is restricted to `admin` and `bursar` only
- [X] T017 [US3] Verify `POST /api/kiosk/student-attendance/validate-teacher` in `backend/app/Controllers/Api/StudentKioskController.php` still validates teachers by `employee_id` from the `staff` table (not from `users`) — no code change expected; this is a read-and-confirm task to ensure account deactivation did not break teacher kiosk auth

**Checkpoint**: US3 confirmed functional. Teacher kiosk attendance flow works via Employee ID. Teachers cannot log in via the standard login page.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and verification across all three user stories.

- [X] T018 [P] Remove the now-unused `DriverDashboard` import and file from `frontend/src/pages/DriverDashboard.tsx` only if the driver kiosk page in T014 fully replaces its functionality — archive or delete the file
- [ ] T019 Run the full quickstart.md validation checklist across all three parts to confirm end-to-end correctness
- [X] T020 [P] Update `transport_routes` admin UI (if any role selector for `driver_user_id` exists in the frontend) to instead show a staff member picker bound to `driver_staff_id` — check `frontend/src/` for any TransportRoute form components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1 (Phase 3)**: Depends on Phase 2 (T001, T002 must complete first)
- **US2 (Phase 4)**: Depends on Phase 2; T008→T009 must be sequential; T010→T011→T012 sequential; T013→T014→T015 can follow T013 completion
- **US3 (Phase 5)**: Depends on US1 completion (T007 must have run)
- **Polish (Phase 6)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — no dependency on US2 or US3
- **US2 (P2)**: Depends only on Foundational — no dependency on US1 or US3
- **US3 (P3)**: Depends on US1 (account deactivation must have run) — lightweight verification only

### Within Each User Story

- T004 before T007 (create migration before running it)
- T008 before T009 (create migration before running it)
- T010 before T011 (add `validate()` before `roster()` in same file)
- T012 before testing endpoints (routes must be registered)
- T013 before T014 (API functions before the page that calls them)
- T014 before T015 (page component before registering its route)

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T005 and T006 can run in parallel (different files, both depend only on T001)
- T003 can run in parallel with T005/T006
- T013 and T010/T011/T012 can run in parallel (frontend vs backend)

---

## Parallel Example: User Story 2

```bash
# Backend and frontend streams run in parallel after T009:
Stream A: T010 → T011 → T012  (DriverKioskController + routes)
Stream B: T013 → T014 → T015  (api.ts + DriverKioskPage + App.tsx)
# Both streams converge at T019 (quickstart validation)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001, T002)
2. Complete Phase 3: US1 (T003–T007)
3. **STOP and VALIDATE**: Test via quickstart.md Part 1
4. Ship: tenant role restriction + account cap + teacher/driver account deactivation

### Incremental Delivery

1. Foundation (T001–T002) → all role validation updated
2. US1 (T003–T007) → role cap enforced, stale accounts deactivated (MVP)
3. US2 (T008–T015) → driver kiosk live
4. US3 (T016–T017) → teacher kiosk confirmed, cleanup done
5. Polish (T018–T020) → DriverDashboard cleanup, transport admin UI updated

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- Each user story is independently deliverable and testable
- Migrations must be applied in order (T004 before T007; T008 before T009)
- The teacher kiosk (US3) requires no new backend code — it is already live from specs/011
- `driver_staff_id` must be populated manually in the DB (or via an admin UI update in T020) before the driver kiosk can return real data for a given driver
