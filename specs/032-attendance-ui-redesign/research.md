# Research: Attendance UI Redesign & Staff Attendance Bug Fixes

**Feature**: `032-attendance-ui-redesign`  
**Date**: 2026-04-14

---

## R-001: Bug Verification — `staffLeave.type` vs `staffLeave.leaveType`

**Decision**: Fix `staffLeave.type === 'half_day'` → `staffLeave.leaveType === 'half_day'` in `attendanceStateTransitions.ts`

**Evidence**: `LeaveRequest` interface in `src/types/dashboard.ts` defines the field as `leaveType` (line 678). The property `type` does not exist on `LeaveRequest`. The `leaveType` union includes `'annual' | 'sick' | 'maternity' | 'paternity' | 'study' | 'unpaid' | 'compassionate'` — notably `'half_day'` is NOT in the union. This means half-day leave is a distinct concept and the check in `attendanceStateTransitions.ts:48` using `staffLeave.type` (wrong property) checking for `'half_day'` (not a valid `leaveType` value) would always return `'on_leave'` instead.

**Rationale**: The field name mismatch means the half-day branch is dead code. The correct property is `leaveType`. Since `'half_day'` is not in the `leaveType` union, this check as-written can never be true. The fix should also consider whether half-day should be modelled as a separate boolean flag on `LeaveRequest` or whether the leaveType value `'half_day'` needs to be added to the union — but since the existing codebase already has `'half_day'` as an `AttendanceState` and the status display shows "HALF DAY", the most conservative fix is to correct the property access and leave the leaveType union as-is (half-day detection is best inferred from a dedicated flag or a separate leaveType extension).

**Resolution**: For now, correct the property name to `staffLeave.leaveType`. Since `'half_day'` is not in the current leaveType union, this will resolve gracefully — the half-day branch remains unreachable until the data model is extended. The UI fix is property name correctness; the data model concern is tracked separately.

**Alternatives considered**: Adding `'half_day'` to the `LeaveRequest.leaveType` union and routing that through the DB — deferred as a data model change outside this feature's scope.

---

## R-002: Bug Verification — `isLoading` vs `loading` in `LeaveManagementTab`

**Decision**: Replace `isLoading` destructuring aliases with `loading` in `LeaveManagementTab.tsx`

**Evidence**: `useStaff()` and `useLeaveRequests()` in `useStaffAttendanceData.ts` both return `{ data, loading, error, refetch }` — the property is `loading`, not `isLoading`. The component destructures `{ data: staff = [], isLoading: staffLoading }` and `{ data: leaveRequests = [], isLoading: leaveLoading }`. Since `isLoading` is `undefined`, `staffLoading` and `leaveLoading` are always `undefined` → falsy. The combined `isLoading` guard on line 62 is always `false`, so the loading spinner at line 132 never renders. Users see an empty table flash while data loads.

**Rationale**: Simple rename; no logic change.

**Alternatives considered**: Updating the hooks to also expose `isLoading` as an alias — rejected because it adds unnecessary API surface. Use the existing `loading` property.

---

## R-003: Bug Verification — `getWorkHours()` called without `settings` argument

**Decision**: Change `workHours={getWorkHours()}` → `workHours={getWorkHours(settings)}` in `DailyAttendanceTab.tsx`

**Evidence**: `getWorkHours(settings?: Settings | null): WorkHours` in `staffAttendanceUtils.ts` returns `settings?.staffWorkHours || DEFAULT_STAFF_WORK_HOURS`. Called without arguments, `settings` is `undefined`, so it always returns `{ startTime: "08:30", endTime: "17:00" }` regardless of what the admin has configured. The `settings` variable is already in scope (destructured from `useDailyAttendanceData`).

**Rationale**: One-word fix. `settings` is already available in the component's scope — it just needs to be passed.

---

## R-004: Student Attendance Page — Current UI Gaps

**Decision**: Redesign `Attendance.tsx` by restructuring the controls card, improving the student table, adding search to the summary, and adding an Excused column.

**Findings**:
- The controls card (`Select Class & Date`) is functional but the quick-action buttons (`Mark All Present`, `Clear All`) are separated from the bulk-action panel, causing cognitive fragmentation.
- The desktop table's `ToggleGroup` status buttons work well but the active-state colours use `data-[state=on]:bg-*` which is not part of shadcn's default ToggleGroupItem — these classes work with TailwindCSS arbitrary data attributes and are already in the project, so no change needed.
- The `attendanceSummary` table is missing a search/filter input and the `excusedDays` column. Both are present in the data structure (`summaryMap` already accumulates `excusedDays`).
- `getStatusBadge` in `Attendance.tsx` uses hard-coded `bg-green-500` / `bg-yellow-500` classes on `<Badge>` which bypasses the variant system — acceptable to retain for percentage badges since there is no semantic variant for "warning percentage".
- The "No attendance records" empty state message is a plain paragraph; it should be a styled empty state card.

**Rationale**: Changes are additive — restructure layout, add search input, add column, improve empty states. No data model changes.

---

## R-005: Staff Daily Attendance Tab — Current UI Gaps

**Decision**: Retain the collapsible section architecture. Improve section headers (colour-coded, consistent chevron animation), improve the stat bar, make Not-Arrived cards consistent with the compact table rows used for Present/Late sections.

**Findings**:
- The `notArrived` group uses a card grid layout (inconsistent with the compact table used for Present/Late).
- The chevron animation uses an empty string `''` vs `'-rotate-90'` — this is backwards: conventionally the chevron points down when open and rotates to point right (−90°) when closed. The current code uses `-rotate-90` when CLOSED and `''` (pointing down) when open — this is actually correct rotation convention.
- The stat bar is already well-structured. Minor refinement: include the inactive staff count as a grey stat and exclude inactive staff from the attendance rate calculation denominator.
- The `staff.length` used in the attendance rate denominator includes inactive staff — they should be excluded.

**Rationale**: Layout consistency + accurate rate calculation.

---

## R-006: Staff Records Tab — Current State Assessment

**Decision**: Minimal UI polish; the core functionality (filters, pagination, table) is already complete. Improvements: move results count above the table; add a "clear filters" shortcut when filters are active; ensure mobile card view matches desktop columns.

**Findings**:
- Results count `"Showing X–Y of Z"` already exists in the pagination section but only shows when `totalPages > 1`. It should always be visible.
- No "clear all filters" button — users can reset each filter individually but a single "Reset Filters" button reduces friction.
- Mobile card layout already implemented and matches desktop intent.

---

## R-007: Leave Management Tab — Current State Assessment

**Decision**: Retain two-section layout (Pending + All). No structural changes needed; fix the `isLoading` bug (R-002) and add minor polish (consistent empty states, status badge colours).

**Findings**:
- The pending section already conditionally renders (`pendingRequests.length > 0`).
- Status badge colours: `approved` uses `'default'` variant (primary colour — usually blue or primary brand). More conventional: use a custom green class or the existing `'default'` which in this project appears as the primary brand colour.
- Leave type badge variants come from `getLeaveTypeVariant()` in `attendanceUtils` — no change needed.

---

## R-008: shadcn/ui Component Availability

**Decision**: All required components already exist in the project. No new components need to be installed.

**Confirmed available**:
- `Card`, `CardHeader`, `CardContent`, `CardDescription`, `CardTitle`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Badge`, `Button`, `Input`, `Select`, `Checkbox`
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Popover`, `PopoverTrigger`, `PopoverContent`
- `Calendar`
- `Skeleton`
- `ToggleGroup`, `ToggleGroupItem`
- `Tooltip`, `TooltipProvider`, `TooltipContent`, `TooltipTrigger`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- `Textarea`
- `DropdownMenu` family

**Additional utility**: `Progress` component from shadcn/ui — verify availability for attendance rate bar in the student summary. If not present, a simple `div` with Tailwind width trick is sufficient.

---

## R-009: Mobile Responsiveness Strategy

**Decision**: Retain the existing `useIsMobile()` + `MobileCard` pattern throughout. No changes to the mobile detection logic.

**Findings**: The project consistently branches desktop/mobile rendering within the same component. This is already established. The redesign follows this pattern without introducing a new responsive strategy.

---

## R-010: Kiosk Non-Touch Guarantee

**Decision**: No files under `src/pages/KioskPage.tsx`, `src/pages/StudentKioskPage.tsx`, `src/pages/DriverKioskPage.tsx`, or any component exclusively used by those pages will be modified.

**Confirmed kiosk-exclusive files** (do not touch):
- `src/pages/KioskPage.tsx`
- `src/pages/StudentKioskPage.tsx`
- `src/pages/DriverKioskPage.tsx`
- Any hook/component with "kiosk" in its name

**Shared components** modified by this feature (confirmed not kiosk-exclusive): `DailyAttendanceTab`, `AttendanceRecordsTab`, `LeaveManagementTab`, `StatusReasonPanel`, `Attendance.tsx`, `StaffAttendance.tsx`, `attendanceStateTransitions.ts`, `staffAttendanceUtils.ts`, `useStaffAttendanceData.ts`.
