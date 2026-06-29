# Tasks: Fix Frontend Bugs and UI Inconsistencies

**Input**: Design documents from `/specs/022-fix-frontend-bugs-ui/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks (different files, no shared dependencies)
- **[Story]**: Which user story this implements (US1–US4)
- Paths are relative to `frontend/src/`

## Path Conventions

All source changes are within `frontend/src/`. No backend or test changes.

---

## Phase 1: Setup

**Purpose**: Confirm working environment is ready before any code changes.

- [x] T001 Confirm branch `022-fix-frontend-bugs-ui` is checked out and `npm run lint` passes cleanly in `frontend/` with zero pre-existing errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Centralize the `BalanceDisplay` component so all user stories that touch financial display use a single source of truth. MUST complete before US1 and US3 tasks that reference balance coloring.

**⚠️ CRITICAL**: T003 depends on T002.

- [x] T002 Update `frontend/src/components/BalanceDisplay.tsx` — remove hardcoded `'USD'` currency; accept a `currency` prop (default `'USD'` for backwards compatibility); apply consistent color classes from `data-model.md` BalanceIndicator contract (`text-green-600 dark:text-green-400` / `text-amber-600 dark:text-amber-400` / `text-red-600 dark:text-red-400` / `text-muted-foreground`)
- [x] T003 Remove inline balance color maps from `frontend/src/pages/StudentProfile.tsx` — replace any hardcoded `text-green-600` / `text-red-600` inline color logic with the updated `<BalanceDisplay>` component (depends on T002)

**Checkpoint**: `BalanceDisplay` is now the single color authority — other components can safely reference it.

---

## Phase 3: User Story 1 — Reliable Error Feedback (Priority: P1) 🎯 MVP

**Goal**: Every page with a data fetch shows a visible error alert with a Retry button when the fetch fails. No blank screens, no infinite spinners.

**Independent Test**: Open DevTools → Network → set Offline. Navigate to `/students/:id`, `/`, `/payments`, and `/transport`. Each page must show an error alert with a Retry button. Clicking Retry must re-attempt the fetch.

### Implementation for User Story 1

- [x] T004 [P] [US1] Fix `frontend/src/pages/StudentProfile.tsx` — add `error` and `retryCount` state to `fetchProfile()`; replace silent catch with `setError('Could not load student profile. Check your connection.')` + `setIsLoading(false)`; render `<Alert variant="destructive">` with inline Retry `<Button>` when error is set (per `contracts/error-state-standard.md`)
- [x] T005 [P] [US1] Fix `frontend/src/pages/Dashboard.tsx` — add error state to `loadClassStudents()` and `loadClassAnalytics()` in the Teacher Dashboard branch; replace `console.error` silent failures with `setError()` calls; render error alert in the class analytics section
- [x] T006 [P] [US1] Fix `frontend/src/pages/Payments.tsx` — replace `Promise.all` with `Promise.allSettled`; map rejected results to source names (`['payments', 'students', 'classes', 'payment categories', 'balances']`); set error message listing which sources failed (per `contracts/error-state-standard.md` multi-source pattern)
- [x] T007 [P] [US1] Fix `frontend/src/pages/Transport.tsx` — add `error` + `retryCount` state to `fetchData()`; replace generic catch toast with `setError('Could not load transport data. Check your connection.')` + error alert render with Retry button
- [x] T008 [P] [US1] Fix `frontend/src/pages/Students.tsx` — add `error` + `retryCount` state to `fetchStudents()`; show error alert in the page body when fetch fails (not just a toast); toast can remain as supplementary notification
- [x] T009 [P] [US1] Fix `frontend/src/pages/Classes.tsx` — audit `fetchData()` error handling; add error state + error alert render + Retry button following the same pattern as T004–T008
- [x] T010 [US1] Fix `frontend/src/pages/StudentProfile.tsx` tab loading — ensure the Fee Statement tab and other sub-tabs show a `<Skeleton>` while their individual data loads, and an error state if their fetch fails (depends on T004)

**Checkpoint**: US1 complete — navigate to any page with DevTools offline. Every page shows an error alert with a working Retry button.

---

## Phase 4: User Story 2 — No Crashes from Null Data (Priority: P1)

**Goal**: All modals open without crashing when optional fields (enrollment, guardian, hire date) are absent from the student or staff record.

**Independent Test**: Open Record Payment modal for a student with no class enrollment. Open Student Form modal for a student with no secondary guardian. Open Staff Form modal for a staff record with no hire date. All three must open without errors and show blank fields rather than crashing.

### Implementation for User Story 2

- [x] T011 [P] [US2] Fix `frontend/src/components/modals/RecordPaymentModal.tsx` — replace `student.currentEnrollment.classId` and `student.currentEnrollment.className` with `student?.currentEnrollment?.classId ?? null` and `student?.currentEnrollment?.className ?? ''`; add null guard before `studentBalance.balance` comparison: only compare if `studentBalance != null`
- [x] T012 [P] [US2] Fix `frontend/src/components/modals/StudentFormModal.tsx` — replace `student.guardian.name` with `student?.guardian?.name ?? ''`; replace `student.guardian2?.name` with `student?.guardian2?.name ?? ''`; audit all other guardian field accesses (phone, email, relationship) and apply same `?.` + `?? ''` pattern throughout the form pre-population block
- [x] T013 [P] [US2] Fix `frontend/src/components/modals/StaffFormModal.tsx` — add null guards to all date parsing attempts: wrap each `new Date(staff.hireDate)` and `new Date(staff.dateOfBirth)` with an `if (staff.hireDate)` / `if (staff.dateOfBirth)` guard; default unparseable dates to empty string rather than throwing
- [x] T014 [US2] Audit remaining modals in `frontend/src/components/modals/` for similar optional-field crashes — check `RouteFormModal.tsx` staff list fetch null handling, `TransportAssignmentStatusModal.tsx`, and `PaymentHistoryModal.tsx`; apply `?.` guards wherever nested optional API data is accessed

**Checkpoint**: US2 complete — open each of the three key modals with incomplete data. Zero crashes. Blank fields display instead.

---

## Phase 5: User Story 3 — Consistent UI Appearance (Priority: P2)

**Goal**: Buttons, modals, headings, and balance colors look identical across all pages. No visual noise from inconsistent sizing or layout.

**Independent Test**: Open Students, Staff, Classes, and Transport pages side-by-side. Primary action buttons must be visually identical. Open two different modals — widths and footer button placement must match.

### Implementation for User Story 3

#### 5a — Button standardization (all [P] — different files)

- [x] T015 [P] [US3] Standardize primary action buttons in `frontend/src/pages/Students.tsx`, `frontend/src/pages/Staff.tsx`, `frontend/src/pages/Classes.tsx`, `frontend/src/pages/Transport.tsx` — ensure each "Add …" button uses `<Button>` with no explicit `variant` or `size` props; remove any `className` overrides that set height or padding
- [x] T016 [P] [US3] Standardize icon-only table row action buttons in `frontend/src/components/staff/StaffDesktopRow.tsx` — replace any buttons using `className="h-8 px-3"` with `size="sm"` or `size="icon"` per the button contract; apply `variant="ghost"` to all icon-only edit/delete row actions
- [x] T017 [P] [US3] Fix kiosk page buttons in `frontend/src/pages/KioskPage.tsx`, `frontend/src/pages/StudentKioskPage.tsx`, `frontend/src/pages/DriverKioskPage.tsx` — replace hardcoded `h-14 px-8` inline class strings with `size="lg"` on the `<Button>` component

#### 5b — Modal standardization (all [P] — different files)

- [x] T018 [P] [US3] Fix modal widths in `frontend/src/components/modals/RecordPaymentModal.tsx` — replace `w-[95vw] max-w-[500px]` with `max-w-lg`; audit all other modals in `frontend/src/components/modals/` for any remaining `w-[Xvw]` viewport-relative width expressions and replace with named `max-w-*` classes per the modal contract
- [x] T019 [P] [US3] Standardize modal form field spacing across all modals in `frontend/src/components/modals/` — replace any `space-y-3` or `space-y-6` class on form containers with `space-y-4`; ensure all modal footers use `<DialogFooter>` with Cancel (`variant="outline"`) on the left and Submit (`variant="default"`) on the right
- [x] T020 [P] [US3] Standardize modal footers in `frontend/src/components/settings/` modals (`BillingPreviewModal.tsx`, `CreateAdjustmentModal.tsx`, `CreateRefundModal.tsx`, `LateEnrollmentBillingModal.tsx`) — apply the same `<DialogFooter>` pattern

#### 5c — Heading hierarchy (all [P] — different files)

- [x] T021 [P] [US3] Fix heading hierarchy in `frontend/src/pages/Students.tsx`, `frontend/src/pages/Classes.tsx`, `frontend/src/pages/Transport.tsx` — ensure each page has exactly one `<h1 className="text-2xl font-bold">` page title; rename any orphaned `<h2>` section headers to `<h2 className="text-lg font-semibold">`; rename any `<h3>` subsections to `<h3 className="text-base font-medium">`
- [x] T022 [P] [US3] Fix heading hierarchy in `frontend/src/pages/Payments.tsx`, `frontend/src/pages/Staff.tsx`, `frontend/src/pages/Dashboard.tsx` — same H1/H2/H3 audit and correction as T021
- [x] T023 [P] [US3] Fix heading hierarchy in `frontend/src/pages/Attendance.tsx`, `frontend/src/pages/StaffAttendance.tsx`, `frontend/src/pages/Settings.tsx` — same H1/H2/H3 audit and correction as T021

**Checkpoint**: US3 complete — primary action buttons look identical on all list pages. Modal widths are consistent. Heading hierarchy is correct on all pages.

---

## Phase 6: User Story 4 — Accurate Form Validation (Priority: P2)

**Goal**: Phone numbers with spaces/dashes/parens are accepted. Hire dates in the future are rejected. DOB that implies implausible age is flagged.

**Independent Test**: In the Staff Form modal, enter `+263 77 123 4567` as phone → accepted. Enter tomorrow's date as hire date → shows validation error. Enter a date of birth that implies age 10 → shows validation error.

### Implementation for User Story 4

- [x] T024 [P] [US4] Update phone validation in `frontend/src/components/modals/StudentFormModal.tsx` — add a Zod `.transform()` step that strips spaces, dashes, dots, and parentheses from the phone value before the regex check: `.transform(v => v.replace(/[\s\-().]/g, '')).pipe(z.string().regex(/^\+?[0-9]{10,}$/, 'Enter a valid phone number'))`; apply to all phone fields in the schema
- [x] T025 [P] [US4] Update phone validation in `frontend/src/components/modals/StaffFormModal.tsx` — same phone normalization transform as T024 applied to staff phone fields
- [x] T026 [US4] Add date validation rules to `frontend/src/components/modals/StaffFormModal.tsx` Zod schema — add `.refine()` to hire date field: reject if date is in the future (`new Date(val) > new Date()`); add `.refine()` to date of birth field: reject if computed age < 16 or > 100 (using `(Date.now() - new Date(val).getTime()) / 31557600000`); display validation messages inline under each field using React Hook Form's `formState.errors`

**Checkpoint**: US4 complete — all three validation scenarios in the Independent Test pass without server round-trips.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Lint verification, end-to-end validation, and documentation update.

- [x] T027 [P] Run `npm run lint` in `frontend/` — fix any lint errors or TypeScript type errors introduced by T002–T026 (null guard additions may affect inferred types)
- [ ] T028 Run quickstart.md manual validation — execute all four user story Independent Tests described in `specs/022-fix-frontend-bugs-ui/quickstart.md`; confirm all acceptance scenarios from spec.md pass
- [x] T029 [P] Update `specs/022-fix-frontend-bugs-ui/checklists/requirements.md` — mark all Feature Readiness items as complete now that implementation is done

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS Phase 3 US1 tasks that display balance (T004), and Phase 5 US3 tasks (T020) that reference BalanceDisplay
- **US1 (Phase 3)**: Depends on Phase 2 — T004–T009 can run in parallel; T010 depends on T004
- **US2 (Phase 4)**: Depends on Phase 1 only — can run fully in parallel with Phase 3; T014 depends on T011–T013
- **US3 (Phase 5)**: Depends on Phase 2 (for T020) — all other US3 tasks depend on Phase 1 only; all [P] tasks within US3 run in parallel with each other
- **US4 (Phase 6)**: Depends on Phase 1 only — T024 and T025 run in parallel; T026 depends on T025
- **Polish (Phase 7)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — independent of US2, US3, US4
- **US2 (P1)**: Starts after Phase 1 — independent of US1, US3, US4
- **US3 (P2)**: Starts after Phase 2 — independent of US1, US2, US4
- **US4 (P2)**: Starts after Phase 1 — independent of US1, US2, US3

### Within Each User Story

- All [P]-marked tasks within a phase can run simultaneously (different files)
- Non-[P] tasks within a phase depend on the [P] tasks completing first (T010 on T004; T014 on T011–T013; T026 on T025)
- Commit after each phase checkpoint

### Parallel Opportunities

```bash
# After Phase 2 completes, launch all four stories simultaneously:
# Batch A — US1 error states (T004-T009 all in parallel):
Task T004: StudentProfile.tsx error state
Task T005: Dashboard.tsx error state
Task T006: Payments.tsx Promise.allSettled
Task T007: Transport.tsx error state
Task T008: Students.tsx error state
Task T009: Classes.tsx error state

# Batch B — US2 null safety (T011-T013 all in parallel):
Task T011: RecordPaymentModal.tsx null guards
Task T012: StudentFormModal.tsx null guards
Task T013: StaffFormModal.tsx null guards

# Batch C — US3 buttons (T015-T017 all in parallel):
Task T015: List page primary buttons
Task T016: Table row icon buttons
Task T017: Kiosk page buttons

# Batch D — US4 phone validation (T024-T025 in parallel):
Task T024: StudentFormModal.tsx phone
Task T025: StaffFormModal.tsx phone
```

---

## Implementation Strategy

### MVP First (US1 + US2 — both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (BalanceDisplay)
3. Complete Phase 3 (US1): Error feedback on all pages
4. Complete Phase 4 (US2): Null safety in all modals
5. **STOP and VALIDATE**: Run quickstart.md P1 tests — no blank screens, no crashes
6. Ship P1 fixes independently if needed

### Incremental Delivery

1. Setup + Foundational → baseline confirmed
2. US1 (P1) → error feedback live → validate
3. US2 (P1) → null safety live → validate
4. US3 (P2) → visual consistency live → validate
5. US4 (P2) → form validation live → validate
6. Polish → lint + final sign-off

### Single-Developer Strategy

Work the phases sequentially in this order for maximum logical coherence:
Phase 1 → Phase 2 → Phase 4 (US2, fast null guards) → Phase 3 (US1, error states) → Phase 6 (US4, validation) → Phase 5 (US3, visual sweep) → Phase 7

---

## Notes

- [P] tasks = different files, no shared state — safe to run in the same session as parallel subagent calls
- Each phase has a Checkpoint — stop and manually verify before proceeding
- No new npm packages — all patterns use existing shadcn/ui, Zod, React Hook Form, and React Query
- The BalanceDisplay fix (T002) is the only task that changes a shared component — complete it first
- `npm run lint` in frontend/ should be clean after every phase; don't accumulate lint debt
