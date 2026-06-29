# Data Model: Navbar Data Refresh

**Feature**: 072-navbar-data-refresh  
**Date**: 2026-05-13

---

## Overview

This feature is **frontend-only**. No new database tables, migrations, or backend schema changes are required. The data model is entirely in-memory (TanStack Query cache) and in React component state.

---

## New Entities

### `useGlobalRefresh` Hook State

A custom hook (`src/hooks/useGlobalRefresh.ts`) that encapsulates global refresh logic.

| Field | Type | Description |
|-------|------|-------------|
| `isRefreshing` | `boolean` | `true` when one or more active queries are currently fetching. Derived from `useIsFetching() > 0`. |
| `refreshAll()` | `() => void` | Calls `queryClient.refetchQueries({ type: 'active' })` to re-fetch all currently mounted queries. |

**State transitions**:
- Idle → Refreshing: user clicks navbar refresh button (calls `refreshAll()`)
- Refreshing → Idle: all active in-flight queries complete (success or error)
- Idle: no change if button is clicked while `isRefreshing === true` (button disabled)

---

## Existing Entities (unchanged)

### TanStack Query Cache

No schema changes. The query cache already holds all tenant data in-memory. This feature adds targeted invalidation calls to hook `onSuccess` handlers.

**Domain query key groups** (see `research.md` Decision 7):

| Domain | Key Prefixes |
|--------|-------------|
| Students | `students`, `student-balance`, `student-status-history`, `student-transport-history`, `student-class-attendance-summary` |
| Payments | `payments`, `student-balance` |
| Transport | `transport-routes`, `transport-allocations`, `missing-transport-charges`, `student-transport-history` |
| Student Attendance | `attendance-today`, `attendance-summary`, `class-attendance-register`, `class-attendance-summary`, `session-attendance-summary`, `attendance-audit-log` |
| Classes | `classes`, `class-attendance-summary` |
| Dashboard | `dashboard` |
| Settings | `settings` |
| Subscription | `subscription-plans`, `subscription-current`, `subscription` |
| Staff (TanStack) | `staff-attendance-report`, `staff-attendance-department` |

---

## Validation Rules

- `refreshAll()` MUST be a no-op guard: if `isRefreshing === true`, calling `refreshAll()` again has no effect (button is disabled in UI).
- `onSuccess` invalidation in mutation hooks: only invalidate the domain keys relevant to the mutation's affected entity — never invalidate all keys.

---

## State Transitions Diagram

```
Navbar Refresh Button:
  [idle]  --click--> [disabled + spinning]  --all queries settle--> [idle]
                           |
                           v
              queryClient.refetchQueries({ type: 'active' })
                  (refetches only mounted/active queries)

Automatic Post-Action:
  [mutation onSuccess]
        |
        v
  queryClient.invalidateQueries({ queryKey: [domainPrefix] })
        |
        v
  [affected queries mark stale → refetch if active]
```

---

## Out of Scope

The following manual-cache hooks are **not** connected to the TanStack Query cache and are unaffected by this feature:

- `useStaffAttendanceData.ts` — manual `Map` cache, internal refetch
- `useFeeCampaigns.ts` — manual `useState`, internal `loadCampaigns()`
- `useFeeRules.ts` — manual `useState`, internal `loadAll()`
- `useChargeBatchRollback.ts` — manual `useState`, internal fetch
- `useFeeStructure.ts` — manual `useState`, internal fetch
- `useWorkHours.ts` — manual `useState`, internal fetch
