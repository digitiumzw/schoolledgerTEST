# Tasks: Kiosk Responsive Redesign

**Input**: Design documents from `/specs/019-kiosk-responsive-redesign/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ui-components.md ✅

**Tests**: No test tasks — no tests were requested in the feature specification.

**Organization**: Tasks are grouped by user story. Each kiosk (Staff, Student, Driver) is fully independent — all three user stories can be worked in parallel after setup.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = Staff Kiosk, US2 = Student Kiosk, US3 = Driver Kiosk)

## Path Conventions

All paths are under `frontend/src/`:
- Pages: `frontend/src/pages/`
- Kiosk components: `frontend/src/components/kiosk/`

---

## Phase 1: Setup

**Purpose**: Confirm the dev environment is working and establish a baseline before any changes.

- [x] T001 Start the Vite dev server (`cd frontend && npm run dev`) and manually verify all three kiosk pages load without errors at their current state: `/kiosk/{code}`, `/student-kiosk/{code}`, `/driver-kiosk/{code}`

**Checkpoint**: All three kiosk pages load. Changes can now begin in parallel across all three user stories.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No blocking prerequisites exist for this feature — each kiosk is fully independent. All three user story phases can begin immediately after T001.

> **Note**: This is a pure frontend styling change. No shared infrastructure, no new dependencies, no migrations. User stories US1, US2, and US3 can proceed in parallel.

---

## Phase 3: User Story 1 — Staff Member Signs In/Out (Priority: P1) 🎯 MVP

**Goal**: Make the Staff Attendance Kiosk fully touch-friendly — all interactive elements meet the 44px minimum tap target, layout is responsive from 375px to 1280px, and visual style is consistent.

**Independent Test**: Navigate to `/kiosk/{code}` on a 375px viewport and on a 768px viewport. Verify: input and Continue button are both visible without scrolling; confirmation "Done" button is at least 56px tall; error Retry button is at least 56px tall; no horizontal overflow at any viewport.

### Implementation for User Story 1

- [x] T002 [P] [US1] In `frontend/src/components/kiosk/KioskIdleScreen.tsx`: widen the ID entry container from `max-w-sm` to `max-w-md`; add `pb-safe` / bottom padding (`pb-8`) to ensure the Continue button is visible above the virtual keyboard on portrait devices; confirm the error box uses `text-sm` text and is legible at 375px
- [x] T003 [P] [US1] In `frontend/src/components/kiosk/KioskConfirmation.tsx`: increase the "Done" button height from `h-12` to `h-14`; widen the card container from `max-w-md` to `max-w-lg`; ensure countdown text and status badge are legible at 375px
- [x] T004 [P] [US1] In `frontend/src/pages/KioskPage.tsx`: increase the "Retry" button on the fatal error view from `h-12` to `h-14`; ensure the error card is fully visible on 375px without horizontal scroll

**Checkpoint**: User Story 1 is complete. Staff check-in/out flow is fully touch-friendly. Test independently at 375px and 768px before proceeding.

---

## Phase 4: User Story 2 — Teacher Marks Student Attendance (Priority: P2)

**Goal**: Make the Student Attendance Kiosk fully touch-friendly across its multi-step flow. The critical fix is the per-student status buttons (Present/Absent/Late/Excused) which are currently too small for reliable touch use. All navigation controls become properly sized labeled buttons.

**Independent Test**: Navigate to `/student-kiosk/{code}` on a 375px viewport. Enter a valid teacher ID and select a class. Verify: each student row shows four status buttons in a 2×2 grid (at 375px) that are at least 44px tall and clearly readable; the Submit button is at least 56px tall; Back buttons show both icon and text label; no horizontal overflow; at 768px, the four status buttons appear in a single row.

### Implementation for User Story 2

- [x] T005 [P] [US2] In `frontend/src/components/kiosk/StudentKioskAttendance.tsx`: **critical touch fix** — replace the status button row with a responsive grid: add `grid grid-cols-2 gap-2 sm:grid-cols-4` to the button group wrapper; update each status button from `px-3 py-1.5 text-xs` to `min-h-[44px] px-4 py-2 text-sm font-semibold`; increase student name from `text-base` to `text-lg`; increase the student row padding from `px-4 py-3` to `px-4 py-4`; increase the sticky-footer Submit button from `h-12` to `h-14`; increase the sticky-footer Back button from `h-12` to `h-11`; fix the Back button in the empty state from `h-12` to `h-14`
- [x] T006 [P] [US2] In `frontend/src/components/kiosk/StudentKioskClassList.tsx`: replace the text-link Back button (`flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium`) with a proper labeled button (`flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-gray-200 hover:bg-gray-50 text-gray-700 text-base font-medium`); replace the empty-state Back button from `h-12` to `h-11` with the same labeled style; increase class card minimum height with `min-h-[64px]` and increase padding from `px-5 py-4` to `px-5 py-5`; increase class name from no explicit size to `text-xl` (already correct) and student count row from `text-sm` to `text-base`
- [x] T007 [P] [US2] In `frontend/src/components/kiosk/StudentKioskIdEntry.tsx`: increase bottom padding on the container to prevent the Continue button from being hidden by a virtual keyboard on portrait devices; verify the Continue button is `h-14` (already correct); ensure error box has `text-sm` and is legible at 375px
- [x] T008 [P] [US2] In `frontend/src/components/kiosk/StudentKioskConfirmation.tsx`: increase "Done" button from `h-12` to `h-14`; verify the details card is readable at 375px
- [x] T009 [P] [US2] In `frontend/src/pages/StudentKioskPage.tsx`: increase the "Retry" button on the error view from `h-12` to `h-14` and replace the inline styled button with the same labeled pattern (icon + text); verify error and loading screens have no layout issues at 375px

**Checkpoint**: User Story 2 is complete. The full multi-step student attendance flow is touch-friendly. Test independently at 375px and 768px: enter teacher ID, select class, verify 2×2 status button grid on 375px / 4-column row on 768px, submit, confirm success screen.

---

## Phase 5: User Story 3 — Driver Views Route Roster (Priority: P3)

**Goal**: Make the Driver Kiosk touch-friendly — replace icon-only Back buttons with labeled buttons, increase route card and roster row touch targets, widen list views on larger screens.

**Independent Test**: Navigate to `/driver-kiosk/{code}` on a 375px viewport and on a 768px viewport. Verify: Continue button is 56px tall; route cards are at least 64px tall and fully tappable; Back buttons show ArrowLeft icon + "Back" text label; roster rows are at least 52px tall; route and student names are `text-lg`; no horizontal overflow at any viewport.

### Implementation for User Story 3

- [x] T010 [P] [US3] In `frontend/src/pages/DriverKioskPage.tsx` (routes view): replace the icon-only Back button (`h-10 w-10 rounded-full border`) with a labeled button (`flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-medium` containing `<ArrowLeft className="h-4 w-4" /> Back`); widen the container from `max-w-md` to `max-w-lg`; increase route card padding from `p-4` to `p-5` and add `min-h-[64px]` to each route card button; increase route name from implicit `text-base` to `text-lg font-semibold`
- [x] T011 [P] [US3] In `frontend/src/pages/DriverKioskPage.tsx` (roster view): replace the icon-only Back button with the same labeled pattern as T010; widen the container from `max-w-md` to `max-w-lg`; increase roster row padding from `py-3` to `py-4`; increase student name from `font-medium text-gray-900` (implicit `text-base`) to `text-lg font-medium text-gray-900`
- [x] T012 [P] [US3] In `frontend/src/pages/DriverKioskPage.tsx` (error view): increase the "Retry" button from `h-12` to `h-14` to match the pattern across all kiosk error screens

**Checkpoint**: User Story 3 is complete. Test independently at 375px and 768px: enter driver ID, select a route, verify labeled Back buttons, taller cards and rows, wider layout on tablet.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all three kiosks and any visual consistency cleanup.

- [ ] T013 [P] Visual cross-check at 375px, 768px, 1024px, and 1280px viewports for all three kiosk pages using Chrome DevTools device emulation — verify no horizontal scrollbars, no overlapping elements, and all touch targets meet minimums per `contracts/ui-components.md`
- [ ] T014 [P] Enable touch emulation in Chrome DevTools and do a full walkthrough of each kiosk flow (staff check-in, student attendance for one class, driver route view) to confirm tap targets feel natural on simulated touch input
- [ ] T015 Verify the sticky header and sticky footer in `frontend/src/components/kiosk/StudentKioskAttendance.tsx` do not overlap list content at any viewport size — especially on short-height screens (568px height / iPhone SE landscape)

> **Note**: T013–T015 require manual browser testing and should be completed by the developer before merging.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: N/A — no blocking prerequisites
- **User Stories (Phase 3, 4, 5)**: All depend only on T001 (dev server running). **All three can start in parallel.**
- **Polish (Phase 6)**: Depends on Phase 3 + Phase 4 + Phase 5 completion

### User Story Dependencies

- **US1 (P1)**: Independent — no dependency on US2 or US3. Files: `KioskIdleScreen.tsx`, `KioskConfirmation.tsx`, `KioskPage.tsx`
- **US2 (P2)**: Independent — no dependency on US1 or US3. Files: `StudentKioskIdEntry.tsx`, `StudentKioskClassList.tsx`, `StudentKioskAttendance.tsx`, `StudentKioskConfirmation.tsx`, `StudentKioskPage.tsx`
- **US3 (P3)**: Independent — no dependency on US1 or US2. Files: `DriverKioskPage.tsx` only

### Within Each User Story

All tasks within each user story are marked `[P]` — they touch different files and can be done in parallel.

### Parallel Opportunities

- T002, T003, T004 (US1) can all run in parallel
- T005, T006, T007, T008, T009 (US2) can all run in parallel
- T010, T011, T012 (US3) can all run in parallel
- US1, US2, and US3 can all run in parallel (with different developers)
- T013, T014 (Polish) can run in parallel

---

## Parallel Example: All Three User Stories

```bash
# After T001 completes, launch all three story phases simultaneously:

# Developer A — US1 Staff Kiosk (T002, T003, T004 in parallel):
Task: "KioskIdleScreen container widening and bottom padding"
Task: "KioskConfirmation Done button h-14 and wider card"
Task: "KioskPage error Retry button h-14"

# Developer B — US2 Student Kiosk (T005, T006, T007, T008, T009 in parallel):
Task: "StudentKioskAttendance status buttons 2x2 grid, min-h-[44px]"  ← MOST CRITICAL
Task: "StudentKioskClassList labeled Back button and taller cards"
Task: "StudentKioskIdEntry bottom padding for keyboard"
Task: "StudentKioskConfirmation Done button h-14"
Task: "StudentKioskPage error Retry button h-14"

# Developer C — US3 Driver Kiosk (T010, T011, T012 in parallel):
Task: "DriverKioskPage routes view: labeled Back + taller cards + max-w-lg"
Task: "DriverKioskPage roster view: labeled Back + taller rows + max-w-lg"
Task: "DriverKioskPage error Retry button h-14"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 3: User Story 1 (T002, T003, T004)
3. **STOP and VALIDATE**: Test staff kiosk at 375px and 768px
4. Ship MVP if only staff kiosk is in scope

### Incremental Delivery

1. T001 (Setup) → Foundation ready
2. T002–T004 (US1) → Staff kiosk touch-ready → validate → ship
3. T005–T009 (US2) → Student kiosk touch-ready → validate → ship (most impactful fix)
4. T010–T012 (US3) → Driver kiosk touch-ready → validate → ship
5. T013–T015 (Polish) → Full cross-viewport validation

### Priority Note

T005 (`StudentKioskAttendance.tsx` status button fix) is the highest-impact single task in this feature — it fixes the most critical usability failure identified in the spec. If only one task ships, it should be T005.

---

## Notes

- All tasks are pure Tailwind className changes — no logic, no API, no state changes
- Prop interfaces must not change (see `contracts/ui-components.md` — stability constraints)
- `[P]` tasks touch different files with no shared dependencies — safe to run in parallel
- Each user story is fully independently testable (different URL, different kiosk type)
- Commit after each user story phase to keep changes reviewable
- See `quickstart.md` for dev server setup and responsive test viewport reference
