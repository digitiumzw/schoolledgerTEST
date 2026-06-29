# Tasks: Add Date Filters to Staff Attendance Records

**Input**: Design documents from `/specs/018-staff-attendance-date-filters/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · quickstart.md ✅

**Tests**: No test tasks — not requested in the feature specification.

**Organization**: Tasks are grouped by user story. US1 and US2 share a single foundational task (the utility extension), then proceed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase (different files, no blocking dependency)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every task description

## Path Conventions

```
frontend/src/utils/staffAttendanceUtils.ts          ← utility (Phase 2)
frontend/src/components/staff-attendance/
    AttendanceRecordsTab.tsx                         ← component (Phase 3 & 4)
```

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Extend the shared filter utility so both US1 and US2 can wire date range filtering into the component.

**⚠️ CRITICAL**: Both user story phases depend on this task. Complete before starting Phase 3 or 4.

- [x] T001 Add optional `dateRange?: { start?: Date; end?: Date }` parameter to `filterAndSortRecords` in `frontend/src/utils/staffAttendanceUtils.ts` — import `format` from `date-fns`, apply start/end date string comparisons before the existing search/status filters

**Checkpoint**: `filterAndSortRecords` accepts an optional fifth argument and filters by date range when provided. All existing call sites (no fifth arg) are unaffected.

---

## Phase 3: User Story 1 — Preset Date Range Filter (Priority: P1) 🎯 MVP

**Goal**: Admin can select a preset time range (All, Last 7 Days, Last 30 Days, This Month, Last Month, This Year) and the records table updates immediately to show only matching records.

**Independent Test**: Open Records tab → select "This Month" → only current-month records appear; select "All" → all records return. Pagination resets to page 1 on each change.

### Implementation for User Story 1

- [x] T002 [US1] Add `DateRangePreset` union type and `dateRangePreset` state (default `'all'`), import date-fns helpers (`subDays`, `startOfMonth`, `endOfMonth`, `subMonths`, `startOfYear`, `endOfYear`) in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

- [x] T003 [US1] Add `effectiveDateRange` useMemo that maps `dateRangePreset` to a `{ start, end }` object for the six preset values (returns `undefined` for `'all'` and `'custom'`) in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

- [x] T004 [US1] Add `handleDateRangeChange` useCallback that calls `setDateRangePreset` and `setCurrentPage(1)` in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

- [x] T005 [US1] Pass `effectiveDateRange` as the fifth argument to `filterAndSortRecords` inside the existing `filteredRecords` useMemo; add `effectiveDateRange` to its dependency array in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

- [x] T006 [US1] Add a `Select` dropdown for the date range preset (options: All · Last 7 Days · Last 30 Days · This Month · Last Month · This Year · Custom Range) after the existing status `Select` in the filter bar of `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

**Checkpoint**: User Story 1 fully functional. Preset filters work, table updates, pagination resets. US2 (custom range) not yet wired — "Custom Range" option exists in the dropdown but has no effect yet.

---

## Phase 4: User Story 2 — Custom Date Range Filter (Priority: P2)

**Goal**: Admin can choose "Custom Range" and pick exact start and end dates via calendar pickers. The table filters to the selected window, with inline validation if start is after end.

**Independent Test**: Select "Custom Range" → pick a 2-week window from the past → only records within that window appear. Enter start > end → inline validation message shown, no filtering applied. Pick a valid range → table updates correctly.

**Prerequisite**: Phase 3 (US1) complete — the preset Select and `handleDateRangeChange` must exist before custom pickers are added.

### Implementation for User Story 2

- [x] T007 [US2] Add `customStartDate: Date | undefined` and `customEndDate: Date | undefined` state variables (both default `undefined`) in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

- [x] T008 [US2] Extend `effectiveDateRange` useMemo to handle the `'custom'` case: return `{ start: customStartDate, end: customEndDate }` only when both dates are defined and `customStartDate <= customEndDate`; otherwise return `undefined`; add `customStartDate` and `customEndDate` to the memo dependency array in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

- [x] T009 [US2] Update `handleDateRangeChange` to call `setCustomStartDate(undefined)` and `setCustomEndDate(undefined)` when the new preset is not `'custom'` in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

- [x] T010 [US2] Add two `Popover` + `Calendar` date pickers (start date, end date) that render only when `dateRangePreset === 'custom'` — place them immediately after the preset Select; each date picker updates its respective state setter; both call `setCurrentPage(1)` in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx` (pattern: reuse `Popover`, `PopoverTrigger`, `PopoverContent`, `Calendar`, `Button` — same as `frontend/src/pages/Attendance.tsx` lines 704–749)

- [x] T011 [US2] Add inline validation text in `text-destructive` that renders only when `dateRangePreset === 'custom'` and both dates are defined and `customStartDate > customEndDate` — place it below the custom date pickers in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

**Checkpoint**: Both US1 and US2 fully functional. All preset and custom date filters work. Combined use with staff name search and status filter produces correct AND-logic results.

---

## Phase 5: Polish & Validation

**Purpose**: Confirm all 8 test scenarios from `quickstart.md` pass and ensure no regressions.

- [ ] T012 [P] Run manual validation against all 8 test scenarios in `specs/018-staff-attendance-date-filters/quickstart.md` — verify preset filters, custom range, invalid range validation, combined filters, pagination reset, mobile layout, and "All" restore

- [x] T013 [P] Verify the mobile view uses `paginatedRecords` (already fixed in the bug patch) and that the date filter row stacks correctly on narrow viewports in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No dependencies — start immediately
- **Phase 3 (US1)**: Depends on Phase 2 completion (T001 must be done)
- **Phase 4 (US2)**: Depends on Phase 3 completion (US2 builds on US1's Select + handler)
- **Phase 5 (Polish)**: Depends on Phase 4 completion

### User Story Dependencies

- **US1 (P1)**: Start after T001. All T002–T006 are sequential (same file).
- **US2 (P2)**: Start after T006 (US1 complete). All T007–T011 are sequential (same file).
- **Polish (T012, T013)**: Both are independent of each other [P].

### Within Each Phase

- Changes within a user story phase are sequential (all in `AttendanceRecordsTab.tsx`)
- T001 (utility) and early US1 work (T002 state/imports) could be split across two developers since they touch different files

### Parallel Opportunities

```bash
# Single-developer flow (recommended):
T001 → T002 → T003 → T004 → T005 → T006
            → T007 → T008 → T009 → T010 → T011
                          → T012 (parallel) + T013 (parallel)

# Two-developer split (Phase 2 + Phase 3 start):
Developer A: T001 (utility file)
Developer B: T002 (component imports/state) — different file, no conflict
# Merge before T005 (which depends on T001)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only — 5 tasks)

1. Complete **Phase 2**: T001 — extend utility (5–10 min)
2. Complete **Phase 3**: T002 → T003 → T004 → T005 → T006 (20–30 min)
3. **STOP and VALIDATE**: Run quickstart.md Tests 1, 2, 8
4. Ship: Users can filter by preset date ranges ✅

### Full Delivery (Both Stories — 11 tasks + 2 polish)

1. MVP (above) — preset filters working
2. Complete **Phase 4**: T007 → T008 → T009 → T010 → T011 (20–30 min)
3. Complete **Phase 5**: T012 + T013 in parallel (10–15 min)
4. Ship: Full date filtering with presets, custom range, and validation ✅

---

## Notes

- [P] tasks = different files or no shared state dependency
- The `filterAndSortRecords` fifth parameter is optional — **zero risk of regressions** at existing call sites
- Reuse the `Popover`+`Calendar` pattern from `frontend/src/pages/Attendance.tsx` exactly — do not introduce new component imports
- `date-fns` is already a project dependency — no `npm install` needed
- The mobile pagination bug (using `filteredRecords` instead of `paginatedRecords`) was already patched in the preceding bug-fix session; T013 is a verification step only
