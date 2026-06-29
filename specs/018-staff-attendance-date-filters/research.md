# Research: Staff Attendance Date Filters

**Branch**: `018-staff-attendance-date-filters`  
**Phase**: 0 — Research  
**Date**: 2026-04-08

---

## Decision 1: Where to apply filtering (client-side vs. server-side)

**Decision**: Client-side, on already-fetched records.

**Rationale**: The Records tab already loads all staff attendance via `useAllStaffAttendance()` (which calls `GET /staff-attendance` with no filters). The existing search and status filters both operate client-side on this payload using `filterAndSortRecords()` in `staffAttendanceUtils.ts`. Adding a date range as a third client-side filter is consistent with that pattern, avoids a new API param, and adds no backend risk.

**Alternatives considered**:
- Server-side filter via `startDate`/`endDate` query params: Rejected. The payload is already cached client-side; adding new API params would require cache-busting logic and backend changes (migrations/route changes), adding scope for no functional gain at current data volumes.

---

## Decision 2: Date range presets

**Decision**: `All`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Last Month`, `This Year` plus a `Custom Range` option with two date pickers.

**Rationale**: These match the presets in the student `Attendance.tsx` page (`last30days`, `thisMonth`, `lastMonth`, `thisYear`, `lastYear`, `custom`), giving users a consistent UX across the application. "Last 7 Days" is added as a fast day-level audit range not present in the student page.

**Alternatives considered**:
- Only preset ranges, no custom: Rejected — the spec requires custom range (FR-003).
- Arbitrary user-saved presets: Out of scope (spec says fixed list).

---

## Decision 3: How to integrate with existing `filterAndSortRecords`

**Decision**: Extend the function signature to accept an optional `dateRange` parameter and apply it before search and status filters.

**Rationale**: `filterAndSortRecords` is the single choke-point for all filtering + sorting in the Records tab. Adding a date range parameter there keeps all filter logic in one place (easy to test) and avoids a second `.filter()` call at the component level.

**Alternatives considered**:
- Separate utility `filterByDateRange` composed with `filterAndSortRecords` at call site: Rejected — this spreads filter logic across the component and the util, and there is no reuse need identified.

---

## Decision 4: Date library

**Decision**: Use `date-fns` — already a direct dependency (`import { format, subDays, startOfMonth, ... } from 'date-fns'` in `Attendance.tsx`). No new package install needed.

**Functions needed**: `startOfMonth`, `endOfMonth`, `startOfYear`, `endOfYear`, `subDays`, `format`.

---

## Decision 5: UI components for date pickers

**Decision**: Reuse the `Popover` + `Calendar` + `Button` pattern already used in `Attendance.tsx` (lines 704–749). Use the existing `Select` component for the preset dropdown.

**Rationale**: No new component imports needed. The pattern is already established and tested in the project.

---

## Decision 6: Filter interaction and pagination reset

**Decision**: All three filters (date range, staff name search, status) apply simultaneously with AND logic. Changing any filter resets `currentPage` to 1.

**Rationale**: This matches the existing behavior for the search and status filters (`handleSearchChange` and `handleStatusFilterChange` both call `setCurrentPage(1)`). Consistent UX.

---

## Summary of affected files

| File | Change |
|------|--------|
| `frontend/src/utils/staffAttendanceUtils.ts` | Extend `filterAndSortRecords` with optional `dateRange` param |
| `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx` | Add date filter state, UI controls, wire into filter call |

No backend changes, no migration, no new API surface.
