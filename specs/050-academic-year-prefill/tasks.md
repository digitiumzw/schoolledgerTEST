# Tasks: Academic Year Auto-Prefill for Migration Form

**Input**: Design documents from `/specs/050-academic-year-prefill/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api-contracts.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new hook point and API module entry. These tasks unlock all subsequent work.

- [ ] T001 Add `GET api/class-migration/year-prefill` route in `backend/app/Config/Routes.php` (above the existing `class-migration/preview` route, inside the `$routes->group('api', ...)` block)
- [ ] T002 Add `AcademicYearPrefillData` TypeScript interface and `getAcademicYearPrefill()` function to `frontend/src/api/api.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend service + controller method that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Create `backend/app/Services/AcademicYearPrefillService.php` implementing `getPrefillData(string $tenantId): array` — reads `tenants.academic_calendar` via `AcademicCalendarService::getCurrentTerm()` to derive `currentYear` as `"YYYY/YYYY+1"` from term start date; falls back to `tenants.settings.academicYear` scalar when no term matches today; returns null `currentYear` when neither source yields a year; derives `nextYear` by incrementing both year parts; queries `SELECT DISTINCT academic_year FROM class_instances WHERE tenant_id = ? ORDER BY academic_year DESC` for `availableYears`; sets `nextYearExists`, `fallbackUsed`, and `warning` fields per `data-model.md` derivation rules
- [ ] T004 Add `prefillYears()` public method to `backend/app/Controllers/Api/ClassMigrationController.php` — call `requireRole('admin', 'super_admin')`, instantiate `AcademicYearPrefillService`, call `getPrefillData($this->getTenantId())`, return `$this->success($result, 'Academic year prefill data ready')`; catch `\Throwable` and return `$this->error('Failed to load academic year prefill data', 500)` with `log_message`

**Checkpoint**: `GET /api/class-migration/year-prefill` returns a valid JSON response for an authenticated admin.

---

## Phase 3: User Story 1 — Auto-Prefill Migration Form (Priority: P1) 🎯 MVP

**Goal**: Migration form opens with "From Academic Year" pre-selected to the current active year and "To Academic Year" pre-selected to the next year — zero manual selection required.

**Independent Test**: Open `YearEndMigrationPanel` as an admin whose tenant has a configured active term. Verify both dropdowns are pre-selected on initial render with no user interaction.

### Integration Tests for User Story 1

- [ ] T005 [P] [US1] Create `backend/tests/Controllers/ClassMigration/AcademicYearPrefillTest.php` extending `ClassMigrationTestCase` — test: happy path returns 200 with `currentYear` matching the seeded term's year range, `nextYear` one year ahead, `availableYears` containing the seeded class instance year, and `nextYearExists` true/false based on whether a class instance exists for the next year
- [ ] T006 [P] [US1] Add test case to `AcademicYearPrefillTest.php`: tenant isolation — seed two tenants each with different calendar years; call prefill as tenant A; assert tenant B's years are absent from `availableYears`

### Implementation for User Story 1

- [ ] T007 [US1] Add `seedCalendar(string $tenantId, array $terms): void` helper to `backend/tests/Controllers/ClassMigration/ClassMigrationTestCase.php` — inserts a JSON-encoded `academic_calendar` into the matching tenant row; terms array format: `[['id' => 'term1', 'name' => 'Term 1', 'start' => 'YYYY-MM-DD', 'end' => 'YYYY-MM-DD']]`
- [ ] T008 [US1] Create `frontend/src/hooks/useAcademicYearPrefill.ts` — `useQuery` (TanStack React Query) with `queryKey: ['academicYearPrefill']`; calls `api.getAcademicYearPrefill()`; returns `{ data, isLoading, error }` typed with `AcademicYearPrefillData | null`; toasts on error using `useToast`
- [ ] T009 [US1] Modify `frontend/src/components/classes/YearEndMigrationPanel.tsx` — import `useAcademicYearPrefill`; replace `useState(defaultFromYear())` and `useState(nextYear(defaultFromYear()))` initialisers with `useEffect` that sets `fromYear` and `toYear` from `prefill.currentYear` and `prefill.nextYear` once `prefillData` is loaded and the user has not yet manually changed the values; add `prefillLoaded` ref to prevent overwriting user edits after initial load

**Checkpoint**: Open the migration panel — both year dropdowns auto-populate from the server response on first render.

---

## Phase 4: User Story 2 — Visual Badges in Dropdown (Priority: P1)

**Goal**: Both academic year dropdowns display "(Current Active)", "(Next)"/"(To Be Created)" badges and plain options for historical years, so administrators can instantly identify years without manual computation.

**Independent Test**: Open either dropdown and confirm the correct badge appears next to each labelled option; verify historical years have no badge.

### Implementation for User Story 2

- [ ] T010 [US2] Modify `frontend/src/components/classes/YearEndMigrationPanel.tsx` — replace the two `<Input>` year fields (lines ~162–183) with `<Select>` components from shadcn/ui; populate options from `prefill.availableYears` merged with the derived `nextYear` (if `!nextYearExists`) sorted descending; display each option as its raw label with a badge appended: `currentYear` → `"YYYY/YYYY+1 (Current Active)"`, `nextYear` when not yet existing → `"YYYY/YYYY+1 (To Be Created)"`, `nextYear` when existing → `"YYYY/YYYY+1 (Next)"`, all others → no badge; keep `fromYear` and `toYear` state bound to the Select `value` props
- [ ] T011 [US2] Add tooltip to the `(Current Active)` option in `YearEndMigrationPanel.tsx` — wrap the option label with a `<TooltipProvider>`/`<Tooltip>` from shadcn/ui showing "This is the currently running academic year" on hover/focus
- [ ] T012 [US2] Add test case to `AcademicYearPrefillTest.php`: verify `availableYears` is returned in descending order and contains no duplicates when the same year appears in multiple class instances

**Checkpoint**: Dropdown renders with correct badges; selecting an option updates `fromYear`/`toYear` state; form remains submittable.

---

## Phase 5: User Story 3 — Derived Next Year & Warning Banner (Priority: P2)

**Goal**: When the next academic year has no class instances yet, a "(To Be Created)" option appears and the existing migration pipeline handles it transparently. When no active year is found at all, a warning banner disables the submit buttons.

**Independent Test**: (a) Seed a tenant with only a current year's class instances and no next-year instances — open the panel, select "To Be Created" year, click Preview, confirm the preview API call uses the derived year string. (b) Seed a tenant with no calendar and no class instances — open the panel, confirm the warning banner is visible and both action buttons are disabled.

### Integration Tests for User Story 3

- [ ] T013 [P] [US3] Add test case to `AcademicYearPrefillTest.php`: no-calendar scenario — seed a tenant with no `academic_calendar` and no class instances; call `GET /api/class-migration/year-prefill`; assert response is 200, `currentYear` is null, `warning` is non-null, `availableYears` is empty array
- [ ] T014 [P] [US3] Add test case to `AcademicYearPrefillTest.php`: fallback scenario — seed a tenant with `settings.academicYear = "2025"` but no `academic_calendar` terms; assert `currentYear = "2025/2026"`, `fallbackUsed = true`, `warning` is non-null

### Implementation for User Story 3

- [ ] T015 [US3] Modify `backend/app/Services/AcademicYearPrefillService.php` — implement the full fallback chain: (1) try `AcademicCalendarService::getCurrentTerm()`; (2) on failure, read `tenants.settings` JSON and extract `academicYear` scalar, construct label as `"{year}/{year+1}"`; (3) if still null, set `currentYear = null` and populate `warning`; ensure `nextYear` and `nextYearExists` are always correctly derived when `currentYear` is non-null
- [ ] T016 [US3] Modify `frontend/src/components/classes/YearEndMigrationPanel.tsx` — add warning banner: when `prefillData?.currentYear === null`, render `<Alert variant="destructive">` with `<AlertTitle>No active academic year</AlertTitle>` and `<AlertDescription>No active academic year found. Please configure the current academic year before triggering migration.</AlertDescription>`; disable the "Preview migration" and "Confirm & run migration" buttons when `prefillData?.currentYear === null`
- [ ] T017 [US3] Modify `frontend/src/components/classes/YearEndMigrationPanel.tsx` — add fallback notice: when `prefillData?.fallbackUsed === true`, render an `<Alert>` (non-destructive, informational) below the dropdowns displaying `prefillData.warning` to inform the administrator that today's date is not within any term

**Checkpoint**: (a) "To Be Created" option is selectable and `preview`/`run` APIs accept the derived year string without error. (b) Warning banner appears and buttons are disabled when `currentYear` is null.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Same-year guard, loading states, edge case hardening.

- [ ] T018 Add Zod same-year validation to `YearEndMigrationPanel.tsx`: replace the existing `isValidYearPair` guard or extend it — add an explicit check `fromYear !== toYear`; show inline validation text "The source and destination academic years must be different" when they match; disable the Preview button in this state
- [ ] T019 Add loading skeleton to `YearEndMigrationPanel.tsx`: while `useAcademicYearPrefill` `isLoading` is true, render `<Skeleton className="h-9 w-full" />` in place of each `<Select>` dropdown so the form does not flash with empty state
- [ ] T020 Add test case to `AcademicYearPrefillTest.php`: unauthenticated request to `GET /api/class-migration/year-prefill` returns 401
- [ ] T021 Add test case to `AcademicYearPrefillTest.php`: teacher role request to `GET /api/class-migration/year-prefill` returns 403
- [ ] T022 [P] Update spec status in `specs/050-academic-year-prefill/spec.md` — change `**Status**: Ready` to `**Status**: Implemented`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → No dependencies. Start immediately.
- **Foundational (Phase 2)** → Depends on Phase 1 (route must exist before controller method is wired). Blocks all story phases.
- **Phase 3 (US1)** → Depends on Phase 2 completion. MVP deliverable.
- **Phase 4 (US2)** → Depends on Phase 3 (Select dropdowns need the prefill hook state from US1).
- **Phase 5 (US3)** → Depends on Phase 2 (backend service); Phase 3 (warning banner uses prefill hook). Can start backend tasks T013–T015 in parallel with Phase 4.
- **Phase 6 (Polish)** → Depends on Phase 3–5 completion.

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete. Independently testable.
- **US2 (P1)**: Requires US1 complete (consumes `useAcademicYearPrefill` hook and dropdown state).
- **US3 (P2)**: Backend tasks (T013–T015) can run in parallel with US2. Frontend tasks (T016–T017) require US1 hook to exist.

### Within Each Phase

- T001 and T002 are independent — run in parallel.
- T003 before T004 (controller depends on service).
- T005, T006 can be written in parallel with T007 (different files).
- T007 before T005/T006 (tests need the seed helper).
- T008 before T009 (panel needs the hook).
- T010 before T011 (tooltip is added after Select renders).

---

## Parallel Execution Examples

### Phase 1 (parallel)
```
T001 — Routes.php
T002 — api.ts
```

### Phase 2 (sequential)
```
T003 → T004
```

### Phase 3 (parallel start, then sequential)
```
T007 (seed helper)  →  T005 [parallel]
                    →  T006 [parallel]
T007 → T008 → T009
```

### Phase 5 (backend parallel with Phase 4 frontend)
```
T013 [parallel]     ←─ run alongside Phase 4 (T010-T011)
T014 [parallel]     ←─ run alongside Phase 4 (T010-T011)
T015 → T016 → T017
```

---

## Implementation Strategy

### MVP (User Story 1 only — ~5 tasks)

1. Phase 1: T001, T002
2. Phase 2: T003, T004
3. Phase 3: T007, T008, T009
4. **STOP & VALIDATE**: Confirm both dropdowns prefill on form open with no manual input.
5. Demo/deploy if ready.

### Incremental Delivery

1. MVP (above) → Prefill works, free-text inputs replaced by dropdowns with values.
2. Add Phase 4 (US2) → Badges appear, historical years visible, tooltip present.
3. Add Phase 5 (US3) → "To Be Created" option + warning banner for missing year.
4. Add Phase 6 (Polish) → Same-year guard, loading skeleton, role/auth tests.

---

## Notes

- `[P]` tasks operate on different files and have no blocking task dependencies — safe to run concurrently.
- `[Story]` labels map each task back to the spec user story for traceability.
- No schema migrations — this feature reads existing data only.
- The existing `ClassMigrationService::validateAcademicYears()` provides a server-side safety net against invalid year pairs; client-side Zod guard is the UX layer.
- `AcademicYearPrefillService` must query `class_instances` with `tenant_id` filter (Principle I).
- All backend tests extend `ClassMigrationTestCase` (reuse seeding infrastructure from spec 048).
