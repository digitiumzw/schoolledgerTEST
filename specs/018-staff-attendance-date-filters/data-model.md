# Data Model: Staff Attendance Date Filters

**Branch**: `018-staff-attendance-date-filters`  
**Phase**: 1 — Design  
**Date**: 2026-04-08

---

## New Types

No new database tables or backend schema changes. The following TypeScript types are introduced at the component level:

### `DateRangePreset`

```
type DateRangePreset = 'all' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'
```

### `DateRange`

```
interface DateRange {
  start: Date | undefined   // inclusive lower bound (undefined = no lower bound)
  end: Date | undefined     // inclusive upper bound (undefined = no upper bound)
}
```

**Computed from preset:**

| Preset | `start` | `end` |
|---|---|---|
| `all` | undefined | undefined |
| `last7days` | today − 6 days | today |
| `last30days` | today − 29 days | today |
| `thisMonth` | first day of current month | last day of current month |
| `lastMonth` | first day of previous month | last day of previous month |
| `thisYear` | Jan 1 of current year | Dec 31 of current year |
| `custom` | user-picked start | user-picked end |

---

## Modified Utility Function

### `filterAndSortRecords` (extended signature)

**Location**: `frontend/src/utils/staffAttendanceUtils.ts`

**Current signature**:
```
filterAndSortRecords(
  records: StaffAttendanceRecord[],
  staffNameMap: Map<string, string>,
  searchQuery: string,
  statusFilter: string
): StaffAttendanceRecord[]
```

**New signature**:
```
filterAndSortRecords(
  records: StaffAttendanceRecord[],
  staffNameMap: Map<string, string>,
  searchQuery: string,
  statusFilter: string,
  dateRange?: { start?: Date; end?: Date }  // optional, backward-compatible
): StaffAttendanceRecord[]
```

**Filter logic added** (applied before search and status filters):
```
if dateRange.start is defined → keep only records where record.date >= format(dateRange.start, 'yyyy-MM-dd')
if dateRange.end is defined   → keep only records where record.date <= format(dateRange.end, 'yyyy-MM-dd')
```

The new parameter is optional with no default, so all existing call sites remain unaffected.

---

## State added to `AttendanceRecordsTab`

| State variable | Type | Initial value |
|---|---|---|
| `dateRangePreset` | `DateRangePreset` | `'all'` |
| `customStartDate` | `Date \| undefined` | `undefined` |
| `customEndDate` | `Date \| undefined` | `undefined` |

The computed `DateRange` object is derived inline via `useMemo` from the three state variables above before being passed to `filterAndSortRecords`.

---

## Validation Rules

- When `dateRangePreset === 'custom'` and `customStartDate > customEndDate`: do not apply the date filter; display an inline validation message instead.
- When `dateRangePreset === 'custom'` and either date is `undefined`: do not apply the date filter (wait for both dates).
- Date comparison uses ISO string comparison (`yyyy-MM-dd` format) which is lexicographically correct for date ordering.
