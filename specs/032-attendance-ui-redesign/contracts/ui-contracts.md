# UI Contracts: Attendance UI Redesign

**Feature**: `032-attendance-ui-redesign`  
**Date**: 2026-04-14

> UI contracts define the observable behaviour of each modified component — what props it accepts, what it renders, and what interactions it exposes. Backend API contracts are unchanged.

---

## 1. `Attendance.tsx` — Student Attendance Page

### Layout Structure

```
<SubscriptionGuard>
  <div.space-y-6>
    <!-- Page Header -->
    <div>
      <h1> Attendance Management </h1>
      <p.text-muted-foreground> Mark daily attendance… </p>
    </div>

    <!-- Controls Card -->
    <Card>
      <CardHeader> Select Class & Date </CardHeader>
      <CardContent>
        <div.flex.flex-col.sm:flex-row.gap-4>
          <Select> class picker </Select>
          <Popover+Calendar> date picker </Popover+Calendar>
        </div>
        <div.flex.gap-2.mt-4>
          <Button> Mark All Present </Button>
          <Button> Clear All </Button>
        </div>
        <!-- Bulk Panel: conditional on selectedStudents.size > 0 -->
        <BulkActionPanel />
      </CardContent>
    </Card>

    <!-- Attendance Marking Card: conditional on classStudents.length > 0 -->
    <Card>
      <!-- desktop: Table with Checkbox + # + Name + ToggleGroup -->
      <!-- mobile: MobileCard list with 2×2 button grid -->
      <Button disabled={saving || attendanceRecords.size === 0}> Save Attendance </Button>
    </Card>

    <!-- Empty Class State: when classStudents.length === 0 -->
    <EmptyStateCard message="No students in this class" />

    <!-- Attendance Summary Card -->
    <Card>
      <CardHeader>
        <div> Attendance Summary + date filter Select </div>
        <!-- search input NEW -->
        <Input placeholder="Search by student name…" />
      </CardHeader>
      <CardContent>
        <!-- desktop: Table (Name | Present | Absent | Late | Excused | Total | % | Progress) -->
        <!-- mobile: MobileCard list -->
        <!-- empty state when no records -->
      </CardContent>
    </Card>
  </div>
</SubscriptionGuard>
```

### Attendance Summary Table Columns (desktop)

| Column | Source | Notes |
|--------|--------|-------|
| Student Name | `summary.studentName` | Left-aligned, font-medium |
| Present | `summary.presentDays` | Centred |
| Absent | `summary.absentDays` | Centred |
| Late | `summary.lateDays` | Centred |
| Excused | `summary.excusedDays` | Centred — **NEW** |
| Total Days | `summary.totalDays` | Centred |
| Attendance % | `summary.attendancePercentage` | Badge: green ≥90%, amber 75–89%, red <75% |

### Interactions

| Trigger | Effect |
|---------|--------|
| Class select change | Reload students + attendance + refetch summary |
| Date picker change | Reload attendance for date; summary date not affected |
| Summary search input (≥300ms debounce) | Filter summary rows by `studentName` |
| Date filter select change | Refetch summary with new range |
| Custom start/end date selected | Refetch summary when both are valid and start ≤ end |
| "Mark All Present" | Set all student statuses to `'present'` |
| "Clear All" | Reset `attendanceRecords` map to empty |
| Checkbox select (student) | Add/remove from `selectedStudents` set |
| "Apply to Selected" | Set selected students to `bulkStatus` |
| "Save Attendance" | POST to API; show toast; refresh summary |

---

## 2. `DailyAttendanceTab.tsx` — Staff Daily Attendance

### Layout Structure

```
<div.space-y-6>
  <Card>
    <CardHeader> Today's Attendance + date string </CardHeader>
    <CardContent>
      <!-- Stat Bar -->
      <StatBar counts={present, late, absent, notArrived, onLeave, total} rate={%} />

      <!-- Collapsible sections, each: -->
      <Collapsible>
        <CollapsibleTrigger>
          <Badge colour-coded> STATUS LABEL </Badge>
          <span> (N staff) </span>
          <ChevronDown rotate-when-closed />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <!-- notArrived: card grid -->
          <!-- present/late/absent/onLeave: compact Table -->
        </CollapsibleContent>
      </Collapsible>

      <!-- Empty state when all sections empty -->
    </CardContent>
  </Card>

  <CheckInModal />
  <CheckOutModal />
  <StatusReasonPanel workHours={getWorkHours(settings)} />  ← BUG-003 fix
</div>
```

### Stat Bar Contract

```typescript
interface StatBarProps {
  present: number;      // staffByStatus.present.length
  late: number;         // staffByStatus.late.length
  absent: number;       // staffByStatus.absent.length
  notArrived: number;   // staffByStatus.notArrived.length
  onLeave: number;      // staffByStatus.onLeave.length
  total: number;        // activeStaff.length  ← excludes inactive
  rate: number;         // (present + late) / total * 100, integer
  currentTime: string;
  periodLabel: string;
}
```

### Attendance Rate Denominator Fix

```typescript
// OLD (includes inactive staff)
const rate = staff.length > 0
  ? Math.round(((present + late) / staff.length) * 100) : 0;

// NEW (excludes inactive staff from denominator)
const activeStaffCount = staff.filter(s => !isStaffInactive(s)).length;
const rate = activeStaffCount > 0
  ? Math.round(((present + late) / activeStaffCount) * 100) : 0;
```

### Compact Table Row Contract (Present / Late / Absent / On Leave sections)

Columns: Name | Position | Status | Check-in | Check-out | Work Hours | Actions

- Check-in / Check-out: formatted time string or `–`
- Work Hours: `formatWorkHours(calculateWorkHours(...))` or `'Incomplete'` if no check-out
- Actions: Check In button (disabled if already checked in), Check Out button (disabled if not checked in; tooltip explains if hovered)

---

## 3. `AttendanceRecordsTab.tsx` — Staff Records

### Filter Bar Contract

```
<div.flex.flex-col.sm:flex-row.gap-4>
  <Input placeholder="Search by staff name…" />
  <Select> status filter (All / Present / Late / Absent / On Leave / Half Day) </Select>
  <Select> date range preset </Select>
  <!-- if filtersActive: -->
  <Button variant="ghost"> Reset Filters </Button>
</div>
<!-- custom date pickers row below when preset === 'custom' -->
```

### Results Count Contract

Always visible above pagination, outside `totalPages > 1` gate:

```
Showing {start}–{end} of {total} records
```

When `filteredRecords.length === 0`:

```
No records match your filters
```

### `filtersActive` Computation

```typescript
const filtersActive = searchQuery !== '' 
  || statusFilter !== 'all' 
  || dateRangePreset !== 'all';
```

### Reset Filters Handler

```typescript
const handleResetFilters = useCallback(() => {
  setSearchQuery('');
  setStatusFilter('all');
  setDateRangePreset('all');
  setCustomStartDate(undefined);
  setCustomEndDate(undefined);
  setCurrentPage(1);
}, []);
```

---

## 4. `LeaveManagementTab.tsx` — Staff Leave

### Bug Fix Contract (BUG-002)

```typescript
// BEFORE (broken — isLoading is always undefined)
const { data: staff = [], isLoading: staffLoading } = useStaff();
const { data: leaveRequests = [], isLoading: leaveLoading } = useLeaveRequests();

// AFTER (correct)
const { data: staff = [], loading: staffLoading } = useStaff();
const { data: leaveRequests = [], loading: leaveLoading } = useLeaveRequests();
```

No layout changes to this component beyond the bug fix.

---

## 5. `attendanceStateTransitions.ts` — Bug Fix Contract (BUG-001)

```typescript
// BEFORE (broken — staffLeave.type does not exist on LeaveRequest)
return staffLeave.type === 'half_day' ? 'half_day' : 'on_leave';

// AFTER (correct property name)
return staffLeave.leaveType === 'half_day' ? 'half_day' : 'on_leave';
```

---

## 6. `staffAttendanceUtils.ts` — No Changes

`getWorkHours(settings)` signature and implementation remain unchanged. The fix is at the call site in `DailyAttendanceTab.tsx`.
