# Implementation Plan: Attendance UI Redesign & Staff Attendance Bug Fixes

**Feature**: `032-attendance-ui-redesign`  
**Date**: 2026-04-14  
**Scope**: Frontend only. No backend, no kiosk.

---

## Technical Context

| Item | Detail |
|------|--------|
| Framework | React 18 + TypeScript (Vite) |
| UI library | shadcn/ui + TailwindCSS |
| State management | Component `useState` + custom hooks with manual cache |
| Data fetching | Custom hooks in `useStaffAttendanceData.ts` (not React Query — despite comments) |
| Date utilities | `date-fns` |
| Icons | `lucide-react` |
| Mobile detection | `useIsMobile()` hook |
| Modified files | 6 files (3 bug fixes, 3 UI redesigns) |
| Kiosk files | **Not touched** |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| No backend changes | ✅ Pass | Frontend logic only |
| Kiosk untouched | ✅ Pass | Explicitly verified (R-010) |
| Existing component patterns followed | ✅ Pass | shadcn/ui, MobileCard, ToggleGroup retained |
| No new dependencies | ✅ Pass | All required components already installed |
| Mobile-first responsive | ✅ Pass | `useIsMobile()` branch retained for all tables |
| SubscriptionGuard unchanged | ✅ Pass | Wrapper not modified |

---

## Phase 1: Bug Fixes (Priority — do first, lowest risk)

### Task 1.1 — BUG-001: Fix `staffLeave.type` → `staffLeave.leaveType`

**File**: `frontend/src/lib/attendanceStateTransitions.ts`  
**Line**: 48  
**Change**: `staffLeave.type === 'half_day'` → `staffLeave.leaveType === 'half_day'`  
**Risk**: Minimal. Corrects a dead-code branch. No behaviour change until `leaveType: 'half_day'` data exists.

---

### Task 1.2 — BUG-002: Fix `isLoading` → `loading` in `LeaveManagementTab`

**File**: `frontend/src/components/staff-attendance/LeaveManagementTab.tsx`  
**Lines**: 53–54  
**Change**: Rename destructured aliases from `isLoading: staffLoading` / `isLoading: leaveLoading` to `loading: staffLoading` / `loading: leaveLoading`  
**Risk**: Minimal. Fixes the loading spinner never appearing.

---

### Task 1.3 — BUG-003: Fix `getWorkHours()` → `getWorkHours(settings)` in `DailyAttendanceTab`

**File**: `frontend/src/components/staff-attendance/DailyAttendanceTab.tsx`  
**Line**: 662  
**Change**: `workHours={getWorkHours()}` → `workHours={getWorkHours(settings)}`  
**Risk**: Minimal. `settings` is in scope. Fixes the `StatusReasonPanel` always using hardcoded defaults.

---

## Phase 2: Staff Attendance UI Improvements

### Task 2.1 — Fix attendance rate denominator in `DailyAttendanceTab`

**File**: `frontend/src/components/staff-attendance/DailyAttendanceTab.tsx`  
**Change**:
- Compute `activeStaffCount = staff.filter(s => !isStaffInactive(s)).length`
- Replace `staff.length` with `activeStaffCount` in the attendance rate calculation and the stat bar total count display
- `isStaffInactive` is already imported from `staffAttendanceUtils`

**Impact**: Inactive staff no longer deflate the attendance rate percentage.

---

### Task 2.2 — Results count always visible in `AttendanceRecordsTab`

**File**: `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`  
**Change**:
- Move the results count `<p>` outside the `totalPages > 1` conditional so it always shows
- Show `"No records match your filters"` when `filteredRecords.length === 0` in the count area
- Compute `filtersActive` boolean (searchQuery ≠ '' || statusFilter ≠ 'all' || dateRangePreset ≠ 'all')
- Add a "Reset Filters" `<Button variant="ghost" size="sm">` to the filter bar that calls `handleResetFilters()`

---

### Task 2.3 — Collapsible section header consistency in `DailyAttendanceTab`

**File**: `frontend/src/components/staff-attendance/DailyAttendanceTab.tsx`  
**Change**:
- Apply consistent colour classes to all section header badges (they vary currently — Absent uses `variant="destructive"` while others use `variant="outline"` with colour classes — standardise to colour-outline pattern for all except Absent)
- Ensure chevron `transition-transform` is applied consistently on all sections (currently `${open ? '' : '-rotate-90'}` — retain as-is since it is correct)
- "Not Arrived" card grid: apply same column count and gap as the other card sections for visual consistency

---

## Phase 3: Student Attendance Page (`Attendance.tsx`) Redesign

### Task 3.1 — Add search to Attendance Summary section

**File**: `frontend/src/pages/Attendance.tsx`  
**Change**:
- Add `summarySearchQuery` state (`useState<string>('')`)
- Add debounced `filteredSummary` memo: filter `attendanceSummary` by `studentName.toLowerCase().includes(summarySearchQuery.toLowerCase())`
- Add `<Input>` with search icon above the summary table (inside `CardContent`, before the table)
- Replace direct `attendanceSummary.map(...)` with `filteredSummary.map(...)`
- Show `"No students match your search"` empty state when `filteredSummary.length === 0` but `attendanceSummary.length > 0`

---

### Task 3.2 — Add Excused column to Attendance Summary table

**File**: `frontend/src/pages/Attendance.tsx`  
**Change**:
- Desktop table: add `<TableHead className="text-center">Excused</TableHead>` after Late column
- Desktop table: add `<TableCell className="text-center">{summary.excusedDays}</TableCell>` in each row
- Mobile MobileCard: add Excused stat tile alongside Present/Absent/Late in the 2×2 grid (extend to 2×3 or add as a third row)
- Update `colSpan={6}` empty-state cell to `colSpan={7}` (one extra column)

---

### Task 3.3 — Attendance Summary sort by percentage

**File**: `frontend/src/pages/Attendance.tsx`  
**Change**:
- Add `summarySortOrder` state: `useState<'asc' | 'desc'>('desc')`
- `filteredSummary` memo applies sort after filter: `sorted.sort((a, b) => summarySortOrder === 'desc' ? b.attendancePercentage - a.attendancePercentage : a.attendancePercentage - b.attendancePercentage)`
- Make the "Attendance %" `<TableHead>` clickable: renders a sort icon (ChevronUp/ChevronDown from lucide-react) and toggles `summarySortOrder` on click
- Default sort: descending (highest attenders first)

---

### Task 3.4 — Improve empty states in `Attendance.tsx`

**File**: `frontend/src/pages/Attendance.tsx`  
**Change**:
- The existing "No students in this class" empty state card is adequate; ensure it renders even when `classStudents.length === 0` but `selectedClassId` is set
- Improve the "No attendance records" paragraph: replace with a styled `<Card>` containing an icon and message matching the design language of other empty states in the project
- When `loadingSummary` and `attendanceSummary.length === 0` after load with a non-'custom' filter: show `"No attendance records found for this period"` rather than a generic paragraph

---

## Phase 4: Summary of File Changes

| File | Change Type | Tasks |
|------|-------------|-------|
| `src/lib/attendanceStateTransitions.ts` | Bug fix | 1.1 |
| `src/components/staff-attendance/LeaveManagementTab.tsx` | Bug fix | 1.2 |
| `src/components/staff-attendance/DailyAttendanceTab.tsx` | Bug fix + UI polish | 1.3, 2.1, 2.3 |
| `src/components/staff-attendance/AttendanceRecordsTab.tsx` | UI polish | 2.2 |
| `src/pages/Attendance.tsx` | UI redesign | 3.1, 3.2, 3.3, 3.4 |

**Files NOT modified**: `StatusReasonPanel.tsx`, `staffAttendanceUtils.ts`, `useStaffAttendanceData.ts`, `StaffAttendance.tsx` (page shell), all kiosk pages, all modals.

---

## Phase 5: Verification Checklist

After implementation, verify:

- [ ] BUG-001: Staff with `leaveType: 'half_day'` shows "Half Day" status (requires test data with that value)
- [ ] BUG-002: Opening Leave Management tab shows loading spinner while data fetches
- [ ] BUG-003: `StatusReasonPanel` in DailyAttendanceTab shows configured work hours (not hardcoded 08:30–17:00) when settings differ
- [ ] Attendance rate in DailyAttendanceTab excludes inactive staff from denominator
- [ ] Records tab results count shows even when all records fit on one page
- [ ] Records tab "Reset Filters" button appears when any filter is active and clears all filters
- [ ] Student summary table has Excused column on desktop and mobile
- [ ] Student summary search input filters rows by name
- [ ] Student summary is sortable by Attendance % (click column header)
- [ ] No kiosk files are modified (run `git diff --name-only` and verify no kiosk paths)
- [ ] TypeScript compiles with `npm run build` without errors
- [ ] ESLint passes with `npm run lint`

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BUG-001 half-day branch still unreachable | High (leaveType union doesn't include 'half_day') | Low (cosmetic — won't break anything) | Document for future leaveType extension |
| Breaking mobile layout with new Excused column | Low | Medium | Test on mobile viewport; MobileCard is additive |
| Summary sort interacting badly with search | Low | Low | Sort applied after filter in memo chain |
| Inactive-staff denominator change alters existing dashboard KPIs | None | None | Rate is local to DailyAttendanceTab only |
