# Tasks: Platform Maintenance Mode

**Input**: Design documents from `/specs/091-platform-maintenance-mode/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Per the constitution, endpoint-level curl validation MUST be run after implementation for new or changed API behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/app/`, `frontend/src/`
- Backend: CodeIgniter 4 (PHP 8.1+) — Controllers, Filters, Migrations, Models, Seeds
- Frontend: React 18 + TypeScript — api, hooks, components, pages

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Seed default maintenance settings and register the public route

- [ ] T001 Create migration to seed maintenance default settings in `backend/app/Database/Migrations/2026-06-22-000001_SeedMaintenanceDefaults.php` — inserts `maintenance_mode` (boolean, false), `maintenance_headline` (string, "Platform Under Maintenance"), `maintenance_message` (string, "The platform is currently under maintenance. Service will be restored shortly.") into `platform_settings` table; `down()` removes the three rows
- [ ] T002 [P] Add maintenance default settings to `backend/app/Database/Seeds/PlatformSeeder.php` — add the three maintenance keys to the `$defaults` array so fresh seeds include them

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Public maintenance status endpoint and backend maintenance check infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 [P] Create `MaintenanceController` in `backend/app/Controllers/Api/MaintenanceController.php` — extends `BaseApiController`; `status()` method reads `maintenance_mode`, `maintenance_headline`, `maintenance_message` from `PlatformSetting` model with default fallbacks for empty strings; returns `success()` with `{ maintenance_mode: bool, headline: string, message: string }`
- [ ] T004 Add public route `GET /api/maintenance-status` in `backend/app/Config/Routes.php` — register inside the `api` group but BEFORE the `auth` group so it is accessible without JWT; add `'maintenance-status'` to `JWTAuthFilter::PUBLIC_PATHS` so the global auth filter skips it
- [ ] T005 Add `'maintenance-status'` to `JWTAuthFilter::PUBLIC_PATHS` array in `backend/app/Filters/JWTAuthFilter.php` — ensures the public status endpoint is not blocked by JWT auth

**Checkpoint**: Foundation ready — public maintenance status endpoint works and returns seeded defaults

---

## Phase 3: User Story 1 - Toggle Platform Maintenance Mode (Priority: P1) 🎯 MVP

**Goal**: Platform admin can toggle maintenance mode on/off; when on, non-admin tenant users see a maintenance notice instead of the normal app

**Independent Test**: Admin enables toggle via Platform Control Panel → non-admin tenant user sees maintenance notice → admin disables toggle → tenant user sees normal app

### Implementation for User Story 1

#### Backend

- [ ] T006 [P] [US1] Add maintenance mode check to `JWTAuthFilter::before()` in `backend/app/Filters/JWTAuthFilter.php` — after JWT validation succeeds (after `$request->user = $userData`), check if `PlatformSetting::get('maintenance_mode')` is true; if so and `$userData->role` is not `admin` or `super_admin`, return a 503 JSON response with maintenance headline and message using the standard error envelope; log the interception via `log_message('info', ...)`
- [ ] T007 [US1] Verify `SettingsController::update()` in `backend/app/Controllers/Platform/SettingsController.php` handles maintenance keys correctly — the existing `update()` method already iterates `$body` keys and calls `setSetting()`; confirm that `maintenance_mode` (boolean type), `maintenance_headline` (string type), and `maintenance_message` (string type) are accepted; no code changes needed if the existing logic handles them — if not, add any necessary type casting

#### Frontend — Platform Control Panel (toggle UI)

- [ ] T008 [P] [US1] Add `getMaintenanceStatus` function to `frontend/src/api/api.ts` — unauthenticated GET to `/maintenance-status` using `apiRequest` with `skipExpiry=true`; returns `{ maintenance_mode, headline, message }`
- [ ] T009 [P] [US1] Create `useMaintenanceStatus` hook in `frontend/src/hooks/useMaintenanceStatus.ts` — uses `useQuery` with queryKey `['maintenance-status']`, queryFn calling `api.getMaintenanceStatus()`, `refetchInterval: 30000` (30s polling), `staleTime: 30000`; returns `{ data, isLoading, isError }`
- [ ] T010 [P] [US1] Create `MaintenanceNotice` component in `frontend/src/components/MaintenanceNotice.tsx` — full-screen overlay using shadcn/ui Card; displays `headline` and `message` from props; responsive (mobile + desktop); uses platform design system (TailwindCSS, existing color tokens); shows platform logo; no navigation links or interactive controls
- [ ] T011 [US1] Integrate maintenance check into `frontend/src/App.tsx` — inside `AppLayout` (or as a wrapper around it), call `useMaintenanceStatus()`; if `data.maintenance_mode === true` AND `user.role` is not `admin` or `super_admin`, render `<MaintenanceNotice>` instead of `{children}`; admin/super_admin users see normal app content; ensure the check does not run on `/login`, `/platform-control-panel/*`, kiosk, or receipt routes
- [ ] T012 [P] [US1] Add maintenance toggle UI to Platform Control Panel Settings in `frontend/src/admin/pages/Settings.tsx` — add a new "Maintenance" tab to the `TABS` array with a `Wrench`/`Settings2` icon; in the tab content: show a shadcn/ui `Switch` component bound to `maintenance_mode` state, headline `Input`, message `Textarea`, and a "Save" button; load current values from `settingsQ.data`; save via `saveSettingsMut` with the three maintenance keys in the expected `{ value, type, description }` format; button shows `isPending` loading state and is disabled during save; show current maintenance status indicator (badge) if mode is on

**Checkpoint**: User Story 1 is fully functional — admin can toggle maintenance mode, non-admin tenant users see the notice, admin users bypass it

---

## Phase 4: User Story 2 - Customize Maintenance Notice (Priority: P2)

**Goal**: Admin can edit the maintenance headline and message; empty values fall back to defaults

**Independent Test**: Admin edits headline and message, enables maintenance mode → tenant user sees customized text → admin clears fields → tenant user sees default text

### Implementation for User Story 2

#### Backend

- [ ] T013 [US2] Add default fallback logic to `MaintenanceController::status()` in `backend/app/Controllers/Api/MaintenanceController.php` — when `maintenance_headline` or `maintenance_message` is empty string or null, return the default values ("Platform Under Maintenance" and "The platform is currently under maintenance. Service will be restored shortly.") instead of empty strings

#### Frontend — Platform Control Panel (message editor)

- [ ] T014 [US2] Add headline and message input fields to the Maintenance tab in `frontend/src/admin/pages/Settings.tsx` — add `maintenance_headline` (Input) and `maintenance_message` (Textarea) to the maintenance tab form state; initialize from `settingsQ.data`; include placeholder text showing the defaults; include a "Reset to defaults" button that clears the fields to empty strings; save all three keys together via `saveSettingsMut`
- [ ] T015 [US2] Update `MaintenanceNotice` component in `frontend/src/components/MaintenanceNotice.tsx` — ensure it displays the `headline` and `message` values received from the API (which already include default fallbacks from T013); no additional client-side fallback logic needed

**Checkpoint**: User Story 2 is fully functional — admin can customize the notice text, empty values show defaults

---

## Phase 5: User Story 3 - Administrator Bypass During Maintenance (Priority: P3)

**Goal**: Platform admins and tenant admins retain full access during maintenance; non-admin users see the notice

**Independent Test**: Enable maintenance mode → platform admin accesses Platform Control Panel normally → tenant admin accesses tenant app normally → non-admin tenant user sees maintenance notice

### Implementation for User Story 3

#### Backend

- [ ] T016 [US3] Verify admin bypass in `JWTAuthFilter` maintenance check in `backend/app/Filters/JWTAuthFilter.php` — confirm the role check from T006 correctly bypasses for `admin` and `super_admin` roles; verify that `teacher` and `bursar` roles receive the 503 response; verify that platform routes (`/api/platform/*`) are unaffected because they use `PlatformJWTAuthFilter`

#### Frontend — Admin bypass

- [ ] T017 [US3] Verify admin bypass in `frontend/src/App.tsx` maintenance check — confirm the condition from T011 correctly allows `admin` and `super_admin` users through to normal app content; confirm `teacher` and `bursar` users see `<MaintenanceNotice>`; confirm the Platform Control Panel (`/platform-control-panel/*`) is never blocked by the maintenance check because it uses a separate `PlatformApp` component with its own auth context

**Checkpoint**: All user stories are independently functional — admins bypass, non-admins see notice

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, audit logging verification, and cross-cutting checks

- [ ] T018 [P] Run curl validation for public maintenance status endpoint — `GET /api/maintenance-status` returns 200 with `maintenance_mode: false` and default headline/message; verify no auth required
- [ ] T019 [P] Run curl validation for enabling maintenance mode — `PUT /api/platform/settings` with `maintenance_mode: { value: true, type: "boolean" }` returns 200; verify via `GET /api/maintenance-status` that `maintenance_mode` is now `true`
- [ ] T020 [P] Run curl validation for 503 maintenance response — with maintenance mode on, login as a teacher/bursar user and call any tenant API endpoint (e.g., `GET /api/dashboard`); verify 503 status and maintenance message in response body
- [ ] T021 [P] Run curl validation for admin bypass — with maintenance mode on, login as tenant admin and call `GET /api/dashboard`; verify 200 (not 503)
- [ ] T022 [P] Run curl validation for platform routes unaffected — with maintenance mode on, call `GET /api/platform/dashboard/kpis` with platform token; verify 200
- [ ] T023 [P] Run curl validation for public endpoints unaffected — with maintenance mode on, call `GET /api/kiosk/status` and `POST /api/auth/login`; verify neither returns 503
- [ ] T024 [P] Run curl validation for custom headline and message — `PUT /api/platform/settings` with custom `maintenance_headline` and `maintenance_message`; verify via `GET /api/maintenance-status` that custom values are returned
- [ ] T025 [P] Run curl validation for empty headline/message fallback — `PUT /api/platform/settings` with empty `maintenance_headline` and `maintenance_message` values; verify via `GET /api/maintenance-status` that defaults are returned
- [ ] T026 [P] Run curl validation for disabling maintenance mode — `PUT /api/platform/settings` with `maintenance_mode: { value: false }`; verify via `GET /api/maintenance-status` that `maintenance_mode` is `false`; verify tenant API calls resume normally
- [ ] T027 Run curl validation for audit log entries — after toggle and message updates, call `GET /api/platform/audit` with platform token; verify `platform.settings.update` entries exist with maintenance keys in details
- [ ] T028 Verify frontend mutation loading states — in Platform Control Panel Maintenance tab, verify Save button shows loading state and is disabled during in-flight request; verify `platform-settings` query is invalidated after save (no stale data)
- [ ] T029 Verify frontend maintenance notice polling — enable maintenance mode from Platform Control Panel; open tenant app as non-admin user; verify maintenance notice appears within 30 seconds without manual refresh; disable maintenance mode; verify normal app returns within 30 seconds
- [ ] T030 Verify frontend admin bypass — with maintenance mode on, log in as tenant admin; verify normal app content is shown (not maintenance notice); verify Platform Control Panel is accessible
- [ ] T031 Verify frontend responsive design — open maintenance notice on mobile viewport (375px width) and desktop viewport (1920px width); verify text is readable, layout is centered, no horizontal scroll
- [ ] T032 Run `php lint` on all modified PHP files — `JWTAuthFilter.php`, `MaintenanceController.php`, `Routes.php`, `SeedMaintenanceDefaults.php`, `PlatformSeeder.php`
- [ ] T033 Run `tsc --noEmit` on frontend — verify 0 TypeScript errors
- [ ] T034 Run `eslint` on all new and modified frontend files — `MaintenanceNotice.tsx`, `useMaintenanceStatus.ts`, `api.ts`, `App.tsx`, `Settings.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001 must be migrated so the endpoint has data to return)
- **User Story 1 (Phase 3)**: Depends on Foundational (T003-T005 must be complete)
- **User Story 2 (Phase 4)**: Depends on User Story 1 (T012 must exist for the message editor UI)
- **User Story 3 (Phase 5)**: Depends on User Story 1 (T006 and T011 must exist for bypass verification)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (the Maintenance tab UI from T012 is extended with message fields)
- **User Story 3 (P3)**: Depends on US1 (verifies the bypass logic implemented in T006 and T011)

### Within Each User Story

- Backend before frontend (API must exist before frontend calls it)
- Controller before route registration (route must point to existing controller)
- API function before hook (hook calls API function)
- Hook before component (component uses hook)
- Component before integration (integration renders component)

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003 and T005 can run in parallel (different files, T004 depends on both)
- T008, T009, T010 can run in parallel (different files, all consumed by T011/T012)
- T018-T027 curl validation tasks can run in parallel (all independent endpoint tests)
- T032, T033, T034 lint/type-check tasks can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch backend tasks (sequential — filter depends on controller):
Task: "T006 Add maintenance mode check to JWTAuthFilter"
# After T006:

# Launch frontend API + hook + component in parallel:
Task: "T008 Add getMaintenanceStatus to api.ts"
Task: "T009 Create useMaintenanceStatus hook"
Task: "T010 Create MaintenanceNotice component"

# After T008-T010, integrate:
Task: "T011 Integrate maintenance check into App.tsx"
Task: "T012 Add maintenance toggle to Settings.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 (T006-T012)
4. **STOP and VALIDATE**: Test toggle on/off with curl + frontend
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Public endpoint works, seeded defaults exist
2. Add User Story 1 → Toggle works, non-admins see notice, admins bypass → **MVP!**
3. Add User Story 2 → Custom headline/message, empty fallbacks
4. Add User Story 3 → Verify admin bypass for all admin types
5. Polish → Full curl validation suite, lint, type-check, responsive verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The existing `PlatformSetting::get()` method has an in-process static cache — no additional caching needed
- The existing `SettingsController::update()` already logs `platform.settings.update` via `AuditService::logFromRequest()` — no new audit action type needed
- The existing `canManageSettings()` policy (Owner + Admin) already gates `PUT /api/platform/settings` — no new authorization needed
