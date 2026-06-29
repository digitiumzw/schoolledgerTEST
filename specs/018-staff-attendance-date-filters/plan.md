# Implementation Plan: Add Date Filters to Staff Attendance Records

**Branch**: `018-staff-attendance-date-filters` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/018-staff-attendance-date-filters/spec.md`

## Summary

Add a date range filter to the Staff Attendance Records tab. Users can select a preset range (All, Last 7 Days, Last 30 Days, This Month, Last Month, This Year) or enter a custom date window. Filtering is applied client-side on already-fetched records by extending the existing `filterAndSortRecords` utility. No backend or schema changes are required.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend) · PHP 8.1+ (backend — unchanged)  
**Primary Dependencies**: React 18, React Router v6, TanStack React Query, TailwindCSS, shadcn/ui, date-fns (existing)  
**Storage**: N/A — client-side filter on in-memory data  
**Testing**: Manual browser testing per `quickstart.md`  
**Target Platform**: Web (desktop + mobile responsive)  
**Project Type**: Web application — React SPA (frontend only for this feature)  
**Performance Goals**: Filter response < 100ms for up to 1,000 in-memory records  
**Constraints**: No new API calls; no backend changes; backward-compatible utility signature  
**Scale/Scope**: One component (`AttendanceRecordsTab`) + one utility (`staffAttendanceUtils`)

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I — Multi-Tenant Isolation | ✅ N/A | No new backend queries |
| II — API-First Separation | ✅ Compliant | Client-side filter on fetched data; no frontend business logic added to backend |
| III — JWT Auth | ✅ N/A | No new routes |
| IV — Immutable Migrations | ✅ N/A | No schema changes |
| V — Financial Ledger Integrity | ✅ N/A | Not touching ledger code |

**Gate result**: PASS — all principles satisfied or not applicable.

## Project Structure

### Documentation (this feature)

```text
specs/018-staff-attendance-date-filters/
├── plan.md           ← this file
├── spec.md           ← feature specification
├── research.md       ← Phase 0 decisions
├── data-model.md     ← Phase 1 type definitions and filter logic
├── quickstart.md     ← manual test guide
└── checklists/
    └── requirements.md
```

### Source Code (affected files only)

```text
frontend/
└── src/
    ├── utils/
    │   └── staffAttendanceUtils.ts      ← extend filterAndSortRecords signature
    └── components/
        └── staff-attendance/
            └── AttendanceRecordsTab.tsx  ← add date range state + UI controls
```

No new files required. No backend files touched.

## Implementation Steps

### Step 1 — Extend `filterAndSortRecords` in `staffAttendanceUtils.ts`

Add an optional `dateRange?: { start?: Date; end?: Date }` parameter (fifth arg, backward-compatible).

Inside the function, before the existing search and status filters, apply:
```
if (dateRange?.start) {
  const startStr = format(dateRange.start, 'yyyy-MM-dd');
  filtered = filtered.filter(r => r.date >= startStr);
}
if (dateRange?.end) {
  const endStr = format(dateRange.end, 'yyyy-MM-dd');
  filtered = filtered.filter(r => r.date <= endStr);
}
```

Import `format` from `date-fns` at the top of the utility file.

### Step 2 — Add date range state to `AttendanceRecordsTab`

Add three new `useState` calls:
```ts
const [dateRangePreset, setDateRangePreset] = useState<'all'|'last7days'|'last30days'|'thisMonth'|'lastMonth'|'thisYear'|'custom'>('all');
const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
```

### Step 3 — Compute effective date range via `useMemo`

```ts
const effectiveDateRange = useMemo(() => {
  const today = new Date();
  switch (dateRangePreset) {
    case 'last7days':   return { start: subDays(today, 6), end: today };
    case 'last30days':  return { start: subDays(today, 29), end: today };
    case 'thisMonth':   return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'lastMonth': {
      const lm = subMonths(today, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    case 'thisYear':    return { start: startOfYear(today), end: endOfYear(today) };
    case 'custom':
      if (customStartDate && customEndDate && customStartDate <= customEndDate)
        return { start: customStartDate, end: customEndDate };
      return undefined; // invalid or incomplete — no filter
    default:            return undefined; // 'all'
  }
}, [dateRangePreset, customStartDate, customEndDate]);
```

Import from `date-fns`: `subDays`, `startOfMonth`, `endOfMonth`, `subMonths`, `startOfYear`, `endOfYear`.

### Step 4 — Pass `effectiveDateRange` to `filterAndSortRecords`

```ts
const filteredRecords = useMemo(() => {
  return filterAndSortRecords(records, staffNameLookup, searchQuery, statusFilter, effectiveDateRange);
}, [records, staffNameLookup, searchQuery, statusFilter, effectiveDateRange]);
```

### Step 5 — Add date range handler (resets page)

```ts
const handleDateRangeChange = useCallback((value: string) => {
  setDateRangePreset(value as any);
  setCurrentPage(1);
  if (value !== 'custom') {
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
  }
}, []);
```

### Step 6 — Add UI controls to the filter bar

After the existing status `Select`, add:
- A `Select` for the preset (triggers `handleDateRangeChange`)
- When `dateRangePreset === 'custom'`: two `Popover`+`Calendar` date pickers (same pattern as `Attendance.tsx`)
- When `customStartDate > customEndDate`: show inline validation text in red

Show an inline validation message when start > end:
```tsx
{dateRangePreset === 'custom' && customStartDate && customEndDate && customStartDate > customEndDate && (
  <p className="text-sm text-destructive">Start date must be before end date</p>
)}
```

Layout: the filter row already uses `flex flex-col sm:flex-row gap-4`; the new controls follow the same pattern and stack on mobile.

## Complexity Tracking

*No constitution violations — section not applicable.*
