# Tasks: Kiosk Employee ID & Redesign

**Input**: Design documents from `/specs/010-kiosk-employee-id/`
**Branch**: `010-kiosk-employee-id`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/kiosk-api.md, contracts/staff-api.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. US2 (Employee ID auto-generation) precedes US1 (kiosk check-in) despite equal P1 priority because the kiosk action endpoint depends on staff being identifiable by `employee_id`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in each task description

---

## Phase 1: Setup (Schema Changes)

**Purpose**: Create the migration file that all schema-dependent stories require. No story implementation can be tested until this migration has run.

- [x] T001 Create migration `backend/app/Database/Migrations/2026-04-06-200000_Kiosk_employee_id_improvements.php` with two operations: (1) normalize existing `employee_id` values to `EMP####` format using `MAX()+1` per tenant and backfill any NULL values; (2) add `early_departure` to the `staff_attendance.status` ENUM (`present, absent, late, on_leave, early_departure`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Apply schema changes and update the API routing layer. Both must be done before any user story implementation can be tested end-to-end.

**⚠️ CRITICAL**: No user story can be fully tested until this phase is complete.

- [ ] T002 Run `php spark migrate` in `backend/` to apply the T001 migration; verify `staff.employee_id` values are normalized and `early_departure` appears in the `staff_attendance.status` ENUM via `DESCRIBE staff_attendance`
- [x] T003 [P] Update `backend/app/Config/Routes.php` to change the kiosk status route from accepting `?tenant_id` query param to a path segment: `$routes->get('kiosk/status/(:any)', 'Api\KioskController::status/$1')`, preserving the existing `POST kiosk/action` route

**Checkpoint**: Migration applied and kiosk route updated — user story implementation can now begin.

---

## Phase 3: User Story 2 — Employee ID Auto-Generation (Priority: P1)

**Goal**: Every new staff member automatically receives a unique, sequential `EMP####` Employee ID at insert time, with no admin intervention.

**Independent Test**: Create a new staff member via `POST /api/staff` and confirm the response includes a non-empty `employeeId` in the format `EMP` + 4-digit zero-padded number. Create a second staff member and confirm the IDs are distinct and sequential.

### Implementation for User Story 2

- [x] T004 [P] [US2] Add `employee_id` to `$allowedFields` in `backend/app/Models/StaffModel.php`; add `'employeeId' => $staff['employee_id']` to `formatForApi()` return array; do NOT add `employee_id` to `formatFromApi()` (immutable — never accepted from request body)
- [x] T005 [US2] Implement `generateEmployeeId(array $data): array` as a `$beforeInsert` callback in `backend/app/Models/StaffModel.php`: query `SELECT MAX(CAST(SUBSTRING(employee_id, 4) AS UNSIGNED)) FROM staff WHERE tenant_id = :tenant_id AND employee_id LIKE 'EMP%'`, compute `next_num = (result ?? 0) + 1`, assign `employee_id = 'EMP' . str_pad($next_num, 4, '0', STR_PAD_LEFT)`; on unique constraint violation retry once with `next_num + 1`

**Checkpoint**: `POST /api/staff` response includes `employeeId: "EMP####"`. Rapid successive creates produce distinct IDs. Editing staff via `PUT /api/staff/:id` leaves Employee ID unchanged.

---

## Phase 4: User Story 1 — Staff Member Checks In via Kiosk (Priority: P1) 🎯 MVP

**Goal**: A staff member enters their Employee ID on the kiosk idle screen and receives a personalized check-in or check-out confirmation. The kiosk flow is: idle → processing → confirmation → auto-return to idle after 10 seconds.

**Independent Test**: Open `/kiosk/:code` (or legacy `?tenant_id=` URL), see the idle screen with a school name, live clock, and Employee ID input field. Enter a known Employee ID and confirm the `POST /api/kiosk/action` returns a 200 with `staffName`, `action`, `timestamp`, and `attendanceStatus`. The confirmation screen auto-returns to idle after 10 seconds.

### Backend — User Story 1

- [x] T006 [US1] Update `KioskController::status(string $code)` in `backend/app/Controllers/Api/KioskController.php` to: resolve `$code` path param via `SELECT id, settings FROM tenants WHERE JSON_UNQUOTE(JSON_EXTRACT(settings, '$.kiosk_code')) = ?`; fall back to `?tenant_id` query param for legacy compatibility; return `{ kioskEnabled, schoolName, workHours: { startTime, endTime }, date }` per the kiosk-api.md contract; return 404 `"Kiosk not found"` for unknown codes
- [x] T007 [US1] Update `KioskController::action()` in `backend/app/Controllers/Api/KioskController.php` to: accept `{ kiosk_code, employee_id }` request body; resolve `kiosk_code → tenant_id` (same logic as T006); look up staff by `employee_id` scoped to `tenant_id` (returning 403 `"Employee ID not recognized"` for any mismatch, active or inactive); auto-detect `check_in` vs `check_out` by checking for an existing attendance record today with no `check_out_time`; record the action and return `{ staffName, action, timestamp, date, attendanceStatus }` per kiosk-api.md

### Frontend — User Story 1

- [x] T008 [P] [US1] Update kiosk-related TypeScript types and API functions in `frontend/src/api/api.ts`: remove `staff: KioskStaffMember[]` from `KioskStatusResponse`; add `schoolName: string` and `workHours: { startTime: string; endTime: string } | null`; define `KioskActionRequest { kiosk_code: string; employee_id: string }`; update `KioskActionResult` to add `workHours?: number` and `earlyDeparture?: boolean`; update `getKioskStatus(code: string)` to call `GET /api/kiosk/status/${code}` and `postKioskAction(data: KioskActionRequest)` to call `POST /api/kiosk/action`
- [x] T009 [P] [US1] Update kiosk React Router route in `frontend/src/App.tsx` from `/kiosk` to `/kiosk/:code` so the opaque code is a path segment (not a query param); keep any legacy route handling in KioskPage itself
- [x] T010 [P] [US1] Create `frontend/src/components/kiosk/KioskIdleScreen.tsx`: render school name (from `statusData.schoolName`), live clock updated every second via `setInterval`, and a single Employee ID `<input>` that submits on Enter key press; accept props `onSubmit(employeeId: string)` and `errorMessage?: string`; show error message auto-clearing after 5 seconds; style for tablet (min-width 768px), large font, centered layout with TailwindCSS
- [x] T011 [P] [US1] Update `frontend/src/components/kiosk/KioskConfirmation.tsx` to display: `staffName`, `action` (check-in / check-out), `timestamp`, `date`, and `attendanceStatus` badge (present / late / early_departure); show a 10-second countdown timer; call `onDone()` when countdown expires or user taps a "Done" button; accept a `result: KioskActionResult` prop
- [x] T012 [US1] Redesign `frontend/src/pages/KioskPage.tsx` with four view states (`"idle" | "processing" | "confirmation" | "error"`): extract `code` from `useParams()`; call `getKioskStatus(code)` via React Query on mount; render `KioskIdleScreen` in idle state; show a spinner in processing state; call `postKioskAction({ kiosk_code: code, employee_id })` on ID submit and transition to confirmation on success or idle+error on failure; transition back to idle after `KioskConfirmation.onDone()`; handle legacy `?tenant_id` query param fallback by reading it from `useSearchParams()` when `code` is absent

**Checkpoint**: Full kiosk check-in and check-out flow works end-to-end. Error states (unknown ID, kiosk disabled) display friendly messages and return to idle. Screen auto-resets after 10 seconds.

---

## Phase 5: User Story 3 — Employee ID Displayed on Staff Profile (Priority: P2)

**Goal**: The Employee ID appears in the staff profile header card above the tab navigation, styled as a monospace badge with a copy-to-clipboard button.

**Independent Test**: Navigate to any staff profile page and confirm an Employee ID badge (e.g., `EMP0042`) is visible in the header area without scrolling. Clicking the copy icon copies the ID to the clipboard.

### Implementation for User Story 3

- [x] T013 [P] [US3] Add `employeeId?: string` to the `Staff` interface in `frontend/src/types/dashboard.ts`
- [x] T014 [US3] Update `frontend/src/pages/StaffProfilePage.tsx` to display the Employee ID in the profile header card above the tab navigation: render a `<span>` with the `employeeId` value styled as `bg-slate-100 rounded px-2 py-0.5 font-mono text-sm` alongside a copy icon button that calls `navigator.clipboard.writeText(staff.employeeId)` on click; render nothing (no placeholder) if `employeeId` is absent

**Checkpoint**: Every staff profile with an assigned Employee ID shows the badge in the header. The copy button works. Profiles for staff without an ID (edge case) render without errors.

---

## Phase 6: User Story 4 — Kiosk URL Hides Tenant ID (Priority: P2)

**Goal**: The kiosk URL displayed in Settings uses an opaque short code (`/kiosk/xK3mP9vR2q`) instead of `?tenant_id=uuid`. The code is auto-generated on first settings save and persisted in `tenants.settings`.

**Independent Test**: Open the Settings page and confirm the kiosk URL shown is in `/kiosk/{code}` format with no tenant UUID visible. Open the URL in an incognito window and confirm the correct tenant's kiosk loads.

### Backend — User Story 4

- [x] T015 [US4] Update `SettingsController` in `backend/app/Controllers/Api/SettingsController.php`: in `PUT /api/settings`, if `settings['kiosk_code']` is absent or empty, generate a 10-character alphanumeric token using `bin2hex(random_bytes(5))` (or equivalent), store it in the JSON, and save; in `GET /api/settings`, include `"kioskCode"` (camelCase) in the response data using the value from `settings['kiosk_code']`; never accept `kiosk_code` from the request body (silently ignore if submitted)

### Frontend — User Story 4

- [x] T016 [P] [US4] Update the settings API response type in `frontend/src/api/api.ts` to include `kioskCode?: string` in the settings data shape; update `getSettings()` return type accordingly
- [x] T017 [US4] Update `frontend/src/components/settings/GeneralSettingsTab.tsx` to construct and display the kiosk URL as `${window.location.origin}/kiosk/${settings.kioskCode}` alongside a copy button; remove any display of `?tenant_id=` format; if `kioskCode` is absent (not yet generated), show a placeholder instructing the user to save settings first

**Checkpoint**: Settings page shows kiosk URL in new format. Opening the URL loads the correct tenant's kiosk without exposing a tenant UUID.

---

## Phase 7: User Story 5 — Kiosk Uses Work Hours for Attendance Behavior (Priority: P2)

**Goal**: The kiosk idle screen shows configured shift hours. Check-in punctuality is evaluated against the configured `startTime`. Checkouts more than 30 minutes before `endTime` are flagged as `early_departure`.

**Independent Test**: Set Work Start Time to `07:00` in Settings. Check in a staff member via the kiosk and confirm their status is `present`. Set start time to `09:00` and repeat on the next day — the same 07:30 check-in should be `present`. Configure `endTime` to `16:30`, check out a staff member at `15:00`, and confirm `attendanceStatus: "early_departure"` in the response and confirmation screen.

### Backend — User Story 5

- [x] T018 [US5] Update `KioskController::status()` in `backend/app/Controllers/Api/KioskController.php` to include `schoolName` (from `settings['schoolName']`) and `workHours` (from `settings['staffWorkHours']`, or `{ "startTime": "08:30", "endTime": "17:00" }` as default if absent) in the 200 response; return `workHours: null` when kiosk is disabled
- [x] T019 [US5] Update `KioskController::action()` in `backend/app/Controllers/Api/KioskController.php` to apply early departure detection on `check_out`: compute `$endMins = hours(endTime)*60 + minutes(endTime)`; compute `$nowMins = (int)date('H')*60 + (int)date('i')`; if `($endMins - $nowMins) > 30`, update the attendance record's `status` to `early_departure` and include `"earlyDeparture": true, "workHours": <float>` in the response; default `workHours` config to `17:00` if `staffWorkHours.endTime` is absent

### Frontend — User Story 5

- [x] T020 [P] [US5] Update `frontend/src/components/kiosk/KioskIdleScreen.tsx` to display configured shift hours from `statusData.workHours`: render `"Shift: {startTime} – {endTime}"` below the school name when `workHours` is non-null; omit this line if `workHours` is null
- [x] T021 [P] [US5] Update `frontend/src/components/kiosk/KioskConfirmation.tsx` to show work-hours context on checkout: if `result.workHours` is present, render `"{workHours.toFixed(1)} hours worked"`; if `result.earlyDeparture` is true, render an `"Early departure"` badge alongside the `attendanceStatus`

**Checkpoint**: Idle screen shows shift hours. Check-in status reflects live work-hours config. Early departure is flagged correctly on checkout. All five user stories work together in the full kiosk flow.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, backward compatibility, and end-to-end validation per quickstart.md.

- [x] T022 [P] Verify legacy `?tenant_id=` query param fallback in `frontend/src/pages/KioskPage.tsx`: when `useParams().code` is undefined (old URL format), read `useSearchParams().get('tenant_id')` and pass it to `getKioskStatus()` using the legacy tenant_id path in the backend; ensure no regressions for existing kiosk tablet setups
- [x] T023 [P] Add "Kiosk not found" error state to `frontend/src/pages/KioskPage.tsx`: when `getKioskStatus()` returns a 404, render a full-screen friendly message `"Kiosk not found. Please check the URL."` without exposing any tenant details
- [x] T024 Verify `KioskController::status()` in `backend/app/Controllers/Api/KioskController.php` returns system defaults (`startTime: "08:30"`, `endTime: "17:00"`) when `settings.staffWorkHours` is absent, and that `POST /api/kiosk/action` uses those same defaults for punctuality evaluation — covering first-time tenant setup (FR-015)
- [ ] T025 [P] Run the quickstart.md validation end-to-end: apply migration, start backend and frontend, create a new staff member and confirm Employee ID badge on profile, copy kiosk URL from Settings, open in incognito, verify idle screen with shift hours, enter Employee ID, confirm check-in/check-out confirmation screen and 10-second auto-reset

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — create migration file immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story testing**
- **Phase 3 (US2)**: Depends on Phase 2 (migration backfills employee_id)
- **Phase 4 (US1)**: Depends on Phase 2 (routes) and Phase 3 (staff lookupable by employee_id)
- **Phase 5 (US3)**: Depends on Phase 3 (StaffModel.formatForApi returns employeeId)
- **Phase 6 (US4)**: Depends on Phase 2 (kiosk route updated); integrates with Phase 4 (KioskPage)
- **Phase 7 (US5)**: Depends on Phase 4 (KioskController and KioskIdleScreen exist to update)
- **Polish (Final)**: Depends on all user story phases

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US2 (Employee ID generation) | Foundational | — |
| US1 (Kiosk check-in) | Foundational + US2 | US3 (different files) |
| US3 (Staff profile badge) | US2 (employeeId in API) | US1, US4 |
| US4 (Kiosk URL code) | Foundational | US3 |
| US5 (Work hours) | US1 (components exist to update) | US3, US4 |

### Within Each User Story

- Backend tasks before frontend tasks (API shape must be finalized first)
- Models/types before controllers/components that consume them
- Core flow before edge cases and error states

### Parallel Opportunities (within phases)

- **Phase 3**: T004 and T005 are sequential (T004 sets up the field; T005 implements the callback that uses it)
- **Phase 4**: T008, T009, T010, T011 can all run in parallel (different files); T012 depends on T008–T011
- **Phase 5**: T013 and T014 are sequential (T014 uses the type from T013)
- **Phase 7**: T020 and T021 can run in parallel; T018 and T019 can run in parallel

---

## Parallel Execution Examples

### Phase 4: User Story 1 (after backend T006, T007 are done)

```
# These four frontend tasks can run simultaneously (different files):
Task T008: Update api.ts kiosk types and functions
Task T009: Update App.tsx route to /kiosk/:code
Task T010: Create KioskIdleScreen.tsx
Task T011: Update KioskConfirmation.tsx

# Then, once all four complete:
Task T012: Redesign KioskPage.tsx (depends on T008–T011)
```

### Phase 7: User Story 5 (after Phase 4 is complete)

```
# Backend in parallel:
Task T018: Update KioskController::status() — add workHours + schoolName
Task T019: Update KioskController::action() — early departure detection

# Frontend in parallel:
Task T020: Update KioskIdleScreen.tsx — display shift hours
Task T021: Update KioskConfirmation.tsx — show workHours + earlyDeparture
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T003)
3. Complete Phase 3: US2 — Employee ID generation (T004–T005)
4. Complete Phase 4: US1 — Kiosk check-in flow (T006–T012)
5. **STOP and VALIDATE**: Full kiosk check-in/check-out works with auto-generated IDs
6. Demo/deploy if ready

### Incremental Delivery

1. Setup + Foundational → Schema ready, routes updated
2. Add US2 → Staff get Employee IDs automatically
3. Add US1 → Kiosk check-in/check-out works (MVP!)
4. Add US3 → Employee ID visible on staff profiles
5. Add US4 → Kiosk URL is clean (no tenant UUID)
6. Add US5 → Work hours drive attendance evaluation and kiosk display
7. Polish → Legacy compatibility, edge cases verified

### Parallel Team Strategy

With two developers after Foundational is complete:

- **Developer A**: US2 (T004–T005) → US1 backend (T006–T007) → US5 backend (T018–T019)
- **Developer B**: US1 frontend (T008–T012) → US3 (T013–T014) → US4 frontend (T016–T017) → US5 frontend (T020–T021) → US4 backend (T015)

---

## Notes

- No JWT on kiosk endpoints — this is a documented, justified exception (plan.md Complexity Tracking)
- `kiosk_code` is never accepted from request bodies; always resolved server-side from `tenants.settings`
- `employee_id` is immutable after generation — excluded from `formatFromApi()` and update allowed fields
- Migration file must not edit any existing migration files (project convention: immutable migrations)
- Early departure threshold is fixed at 30 minutes (not configurable in this feature)
- Tests are not included (not requested in the specification)
