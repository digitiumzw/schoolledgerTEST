# Tasks: Staff Attendance Summary — Aligned Column Format

**Input**: Design documents from `/specs/033-staff-attendance-summary-columns/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · data-model.md ✅ · contracts/ui-contract.md ✅ · quickstart.md ✅

**Tests**: Not requested in spec — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- All changes are in one file: `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

---

## Phase 1: Setup

**Purpose**: No project initialization needed — single-file frontend change, no new dependencies.

- [x] T001 Confirm feature branch `033-staff-attendance-summary-columns` is checked out

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Rename the internal `onLeave` field to `excused` in the `staffSummaryData` useMemo. All display tasks (US1 and US2) depend on this field rename being correct first.

**⚠️ CRITICAL**: Tasks T003 and T004 cannot start until T002 is complete (they reference `summary.excused`)

- [x] T002 Rename `onLeave` → `excused` in the `staffSummaryData` useMemo type annotation, initialiser, and switch-case increments in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx` (lines ~166–203): change `onLeave: number` → `excused: number`, `onLeave: 0` → `excused: 0`, and both `entry.onLeave++` increments (under `case 'on_leave'` and `case 'half_day'`) to `entry.excused++`

**Checkpoint**: `staffSummaryData` now produces `excused` counts — TypeScript will error on any remaining `summary.onLeave` references until T003 and T004 are applied.

---

## Phase 3: User Story 1 — Consistent Desktop Table Columns (Priority: P1) 🎯 MVP

**Goal**: Desktop summary table header reads Name | Present | Absent | Late | Excused | Total Days | Attendance %

**Independent Test**: Open Staff Attendance page → scroll to Attendance Summary → confirm desktop table header column 5 is "Excused" and each row's Excused cell shows the correct count.

### Implementation for User Story 1

- [x] T003 [US1] Update desktop table header: change `<TableHead className="text-center">On Leave</TableHead>` → `Excused`, and update the corresponding row `<TableCell className="text-center">{summary.onLeave}</TableCell>` → `{summary.excused}` in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx` (lines ~776 and ~800)

**Checkpoint**: Desktop summary table fully matches student attendance summary column layout. User Story 1 is independently testable and deliverable.

---

## Phase 4: User Story 2 — Consistent Mobile Card Label (Priority: P2)

**Goal**: Mobile summary cards show "Excused" (not "On Leave") with the correct aggregated count.

**Independent Test**: Open Staff Attendance page on a mobile-width viewport → confirm each staff member's summary card shows "Excused" label with a value equal to their on_leave + half_day record count.

### Implementation for User Story 2

- [x] T004 [US2] Update mobile MobileCard summary label and value: change `<p className="text-muted-foreground">On Leave</p>` → `Excused` and `<p className="font-medium">{summary.onLeave}</p>` → `{summary.excused}` in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx` (lines ~754–758)

**Checkpoint**: Mobile and desktop summary displays are consistent. All user stories complete.

---

## Phase 5: Polish & Verification

**Purpose**: Confirm no regressions and TypeScript compiles cleanly.

- [x] T005 Run `npm run build` (or `bun run build`) in `frontend/` and confirm zero TypeScript errors — specifically that no `summary.onLeave` or `entry.onLeave` references remain
- [ ] T006 [P] Manually verify in browser: desktop summary column 5 header = "Excused", counts match previous "On Leave" values, date filters / name search / sort-by-percentage all still work
- [ ] T007 [P] Manually verify mobile viewport: summary cards show "Excused" label with correct count

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2 — T002)**: Depends on Phase 1 — **BLOCKS T003 and T004**
- **User Story 1 (Phase 3 — T003)**: Depends on T002
- **User Story 2 (Phase 4 — T004)**: Depends on T002 (independent of T003)
- **Polish (Phase 5)**: Depends on T003 and T004 both complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on T002 only — no dependency on US2
- **User Story 2 (P2)**: Depends on T002 only — no dependency on US1; can be done in parallel with T003 if working solo on different lines

### Within Each User Story

- T002 must be complete before T003 or T004
- T003 and T004 are independent of each other (different line ranges in the same file — serialize if working solo to avoid conflicts, or split to separate branches if pair programming)

### Parallel Opportunities

- T003 and T004 touch different line ranges in the same file; a single developer should sequence them, but two developers on separate branches could run them in parallel and merge cleanly.
- T005, T006, T007 (polish) can all run after T003+T004 complete; T006 and T007 are manual checks that can happen simultaneously.

---

## Parallel Example: After T002 completes

```
T003 [US1] — Desktop table header + cell (lines ~776, ~800)
T004 [US2] — Mobile card label + value  (lines ~754–758)
↑ These two can be done in parallel (non-overlapping line ranges)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001: confirm branch
2. Complete T002: rename `onLeave` → `excused` in useMemo (Foundational)
3. Complete T003: update desktop table header and cell (US1)
4. **STOP and VALIDATE**: desktop table shows correct columns — MVP delivered
5. Continue with T004 for mobile parity

### Incremental Delivery

1. T001 → T002 → T003: Desktop summary aligned (**MVP**)
2. T004: Mobile summary aligned
3. T005–T007: Verify build and manual smoke test

---

## Notes

- All 4 implementation tasks (T002–T004) are in a single file; total diff is ~7 lines changed
- No new imports, no new dependencies, no backend changes
- `filteredSummaryData` and the sort comparator reference `attendancePercentage` only — neither touches `onLeave`/`excused`, so they require no changes
- After T002, TypeScript will surface any missed `onLeave` references as compile errors — use that as a safety net
