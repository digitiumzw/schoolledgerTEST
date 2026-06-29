# Tasks: Attendance UI Redesign & Staff Attendance Bug Fixes

**Feature**: `032-attendance-ui-redesign`  
**Generated**: 2026-04-14  
**Total tasks**: 17  
**Scope**: Frontend only. 5 files modified. No backend. No kiosk.

---

## Phase 1 — Foundational Bug Fixes
> These are independent single-line fixes. Do them first; they unblock correct behaviour for all UI work that follows. All three can be done in parallel.

- [x] T001 [P] Fix `staffLeave.type` → `staffLeave.leaveType` on line 48 in `frontend/src/lib/attendanceStateTransitions.ts`
- [x] T002 [P] Fix `isLoading: staffLoading` → `loading: staffLoading` and `isLoading: leaveLoading` → `loading: leaveLoading` on lines 53–54 in `frontend/src/components/staff-attendance/LeaveManagementTab.tsx`
- [x] T003 [P] Fix `workHours={getWorkHours()}` → `workHours={getWorkHours(settings)}` on line 662 in `frontend/src/components/staff-attendance/DailyAttendanceTab.tsx`

---

## Phase 2 — User Story 3: Staff Daily Attendance Overview
> Goal: Accurate attendance rate, consistent section headers, correct work-hours in status panel.  
> Independent test: Open Staff Attendance → Daily tab; stat bar shows correct counts; attendance rate excludes inactive staff; clicking a Late staff member opens StatusReasonPanel showing configured (not hardcoded) work hours.

- [x] T004 [US3] Compute `activeStaffCount` by filtering out inactive staff using `isStaffInactive` (already imported) and replace both uses of `staff.length` in the attendance rate calculation and total-staff display in `frontend/src/components/staff-attendance/DailyAttendanceTab.tsx`
- [x] T005 [US3] Standardise all collapsible section header badges to `variant="outline"` with explicit colour classes (Not Arrived: orange, Present: green, Late: yellow, Absent: red/destructive, On Leave: default/blue) — update all five `<Badge>` elements inside the `CollapsibleTrigger` divs in `frontend/src/components/staff-attendance/DailyAttendanceTab.tsx`
- [x] T006 [US3] Add `transition-transform duration-200` to every chevron `<ChevronDown>` icon in the collapsible section headers (all five sections) and verify the open/closed rotation class `${open ? '' : '-rotate-90'}` is applied consistently in `frontend/src/components/staff-attendance/DailyAttendanceTab.tsx`

---

## Phase 3 — User Story 4: Staff Attendance Records & Filtering
> Goal: Results count always visible; reset-filters shortcut; clear filter UX.  
> Independent test: Open Records tab; results count shows even with one page; apply status filter and see count update; "Reset Filters" button appears and clears all filters on click.

- [x] T007 [US4] Move the results count paragraph outside the `totalPages > 1` gate so it always renders — show `"Showing {start}–{end} of {total} records"` when records exist and `"No records match your filters"` when `filteredRecords.length === 0` in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`
- [x] T008 [US4] Add `filtersActive` computed boolean (`searchQuery !== '' || statusFilter !== 'all' || dateRangePreset !== 'all'`) and a `handleResetFilters` callback that resets all three filters + clears custom dates + resets page to 1 in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`
- [x] T009 [US4] Render a `<Button variant="ghost" size="sm">Reset Filters</Button>` in the filter bar row (after the date range Select) that is only visible when `filtersActive === true` and calls `handleResetFilters` in `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

---

## Phase 4 — User Story 5: Staff Leave Management
> Goal: Loading spinner fires correctly (BUG-002 already fixed in T002). No further structural changes needed.  
> Independent test: Open Leave Management tab on a throttled connection; spinner appears while data loads; pending section shows only unapproved requests; All Requests table loads correctly.

- [ ] T010 [US5] Verify the `isLoading` guard at line 132 now correctly prevents rendering the content before data arrives — no code change needed beyond T002; confirm in browser that spinner appears on load in `frontend/src/components/staff-attendance/LeaveManagementTab.tsx`

> Note: T010 is a verification-only task. If the spinner still does not fire, re-examine the `useStaff` and `useLeaveRequests` hook return shapes.

---

## Phase 5 — User Story 2: Student Attendance Report
> Goal: Summary table has search, Excused column, and sortable Attendance % column.  
> Independent test: Open Attendance page with a class selected; type a name in the search box and see rows filter; Excused column visible; click "Attendance %" header to reverse sort order.

- [x] T011 [P] [US2] Add `summarySearchQuery` state (`useState<string>('')`) and `summarySortOrder` state (`useState<'asc' | 'desc'>('desc')`) near the existing state declarations at the top of the component in `frontend/src/pages/Attendance.tsx`
- [x] T012 [US2] Add `filteredSummary` memoised value: filter `attendanceSummary` where `studentName.toLowerCase().includes(summarySearchQuery.toLowerCase())`, then sort by `attendancePercentage` per `summarySortOrder` (desc by default) — replace all `attendanceSummary.map(...)` in the summary section with `filteredSummary.map(...)` in `frontend/src/pages/Attendance.tsx`
- [x] T013 [US2] Add a search `<Input>` with a `<Search>` icon (already imported) above the summary table inside the `CardContent`, styled `relative flex-1` with the icon absolutely positioned left, before the loading/table conditional block in `frontend/src/pages/Attendance.tsx`
- [x] T014 [US2] Add `<TableHead className="text-center">Excused</TableHead>` after the Late column header and `<TableCell className="text-center">{summary.excusedDays}</TableCell>` in each desktop table row; update the empty-state `colSpan` from 6 to 7 in `frontend/src/pages/Attendance.tsx`
- [x] T015 [US2] Add Excused tile to the mobile `MobileCard` grid alongside Present/Absent/Late (extend from 2×2 to 2×3 grid or add a new row) showing `summary.excusedDays` in `frontend/src/pages/Attendance.tsx`
- [x] T016 [US2] Make the "Attendance %" `<TableHead>` a clickable button that toggles `summarySortOrder` between `'asc'` and `'desc'` and renders a `<ChevronUp>` or `<ChevronDown>` icon from lucide-react matching the current sort direction in `frontend/src/pages/Attendance.tsx`

---

## Phase 6 — User Story 1: Student Attendance Daily Marking
> Goal: Improved empty states for better UX when no students or no records exist.  
> Independent test: Select a class with no students — styled empty-state card appears. Select a class and a date range with no records — styled empty-state message appears instead of a blank table.

- [x] T017 [US1] Replace the plain `<p className="text-center text-muted-foreground py-8">` empty-state paragraph in the attendance summary section with a styled empty-state block (e.g. a centred div with a `Users` icon, a heading, and a sub-message) matching the design language used elsewhere in the project in `frontend/src/pages/Attendance.tsx`

---

## Phase 7 — Polish & Cross-Cutting
> Final lint, build, and kiosk safety check.

- [ ] T018 Run `npm run lint` from `frontend/` and fix any ESLint errors introduced by this feature — no new warnings should be added in `frontend/`
- [x] T019 Run `npm run build` from `frontend/` and confirm TypeScript compiles with zero errors — pay particular attention to the new state types and the `filteredSummary` memo return type in `frontend/`
- [ ] T020 Run `git diff --name-only` and confirm no file path contains `Kiosk` or `kiosk` — if any kiosk file appears, revert that change immediately

---

## Dependency Graph

```
T001 ──┐
T002 ──┼──► (bugs resolved) ──► T004, T005, T006, T007, T008, T009, T010, T011...T017
T003 ──┘

T004 → T005 → T006   (DailyAttendanceTab — sequential edits to same file)
T007 → T008 → T009   (AttendanceRecordsTab — sequential edits to same file)
T011 → T012 → T013 → T014 → T015 → T016 → T017   (Attendance.tsx — sequential edits to same file)

T018, T019, T020   (all depend on all prior tasks complete)
```

**Cross-file parallelism** (safe to execute simultaneously):
- `DailyAttendanceTab.tsx` tasks (T004–T006) in parallel with `AttendanceRecordsTab.tsx` tasks (T007–T009)
- `LeaveManagementTab.tsx` verification (T010) in parallel with either of the above
- Bug fixes T001, T002, T003 all in parallel (different files)

---

## Parallel Execution Examples

**Batch A** (all different files, no dependencies):
```
T001  frontend/src/lib/attendanceStateTransitions.ts
T002  frontend/src/components/staff-attendance/LeaveManagementTab.tsx
T003  frontend/src/components/staff-attendance/DailyAttendanceTab.tsx
```

**Batch B** (after Batch A, two separate files):
```
T004–T006  frontend/src/components/staff-attendance/DailyAttendanceTab.tsx
T007–T009  frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx
```

**Batch C** (after Batch B):
```
T011–T017  frontend/src/pages/Attendance.tsx
T010       frontend/src/components/staff-attendance/LeaveManagementTab.tsx (verify only)
```

**Batch D** (after Batch C):
```
T018  lint
T019  build
T020  kiosk safety check
```

---

## Implementation Strategy

**MVP scope** (User Story 1 + bug fixes — deliverable immediately):
- T001, T002, T003 (bug fixes)
- T017 (empty-state improvement — completes US1)

**Increment 1** (adds Staff Daily polish — completes US3):
- T004, T005, T006

**Increment 2** (adds Staff Records UX — completes US4):
- T007, T008, T009

**Increment 3** (adds Student Summary features — completes US2):
- T011, T012, T013, T014, T015, T016

**Increment 4** (Leave Management verification — completes US5):
- T010

**Final** (polish & safety):
- T018, T019, T020
