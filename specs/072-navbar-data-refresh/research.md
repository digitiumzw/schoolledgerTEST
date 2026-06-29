# Research: Navbar Data Refresh

**Feature**: 072-navbar-data-refresh  
**Date**: 2026-05-13

---

## Decision 1: Manual Refresh Mechanism — `queryClient.invalidateQueries` vs `refetchQueries`

**Decision**: Use `queryClient.invalidateQueries()` (marks stale, refetches if mounted) rather than `refetchQueries()` (forces immediate refetch regardless of mount status).

**Rationale**: `invalidateQueries` only triggers actual network requests for queries that are currently mounted and active on the visible page. `refetchQueries` would blindly fire requests for every key matched in the cache, including unmounted queries for other pages the user has previously visited. Given the scale requirement (large tenants), `invalidateQueries` is strictly more efficient.

**Alternatives considered**:
- `queryClient.refetchQueries({ type: 'active' })` — This also only refetches active queries and is the most direct match to "refresh current page". Selected as the implementation mechanism for the navbar button (see Decision 5).
- Full page `window.location.reload()` — Explicitly excluded by spec. Loses React state, re-runs all JS bootstrap, unacceptable UX.
- Clearing entire cache (`queryClient.clear()`) — Would blank every component simultaneously and trigger requests for inactive queries. Excluded.

---

## Decision 2: Scope of "Manual Refresh" — Page-Active Queries Only

**Decision**: The navbar refresh button calls `queryClient.refetchQueries({ type: 'active' })`, which refetches only queries that have at least one active subscriber (i.e., currently mounted components). It does NOT invalidate the full cache.

**Rationale**: The spec requires "all relevant data for the current tenant" to mean "all data currently visible on screen". Using `type: 'active'` is the TanStack Query canonical way to achieve this. It naturally scopes to the current page without needing page-specific knowledge in the header component.

**Alternatives considered**:
- Maintaining a global registry of "current page query keys" and invalidating those specifically — more precise but adds significant complexity and requires every page to register/deregister its keys. Over-engineered for v1.
- Broadcasting a custom event and having each hook respond — looser coupling but harder to coordinate loading state and completion tracking.

---

## Decision 3: Loading State & Button Disabled Guard

**Decision**: Track in-flight status using `isFetching` from `useIsFetching()` (TanStack Query hook that returns the count of in-flight queries globally). The refresh button shows spinner and is disabled when `useIsFetching() > 0`.

**Rationale**: `useIsFetching()` is a built-in TanStack Query hook that reactively returns the number of queries currently fetching. It covers both manual and background fetches and requires no additional state. The button being disabled while `isFetching > 0` satisfies FR-012 (no concurrent duplicates) naturally.

**Alternatives considered**:
- Local `useState<boolean>` in `AppHeader` — requires manually setting it on click and clearing after all fetches complete. Requires tracking promises, error-prone.
- Context-based `isRefreshing` flag — adds a React context provider, heavier than needed.

---

## Decision 4: Automatic Post-Action Refresh — Standardise `onSuccess` Invalidation

**Decision**: Automatic post-action refresh is achieved by ensuring every `useMutation` `onSuccess` handler calls `queryClient.invalidateQueries` with the appropriate domain query key prefix. This is the pattern already used in `useTransportAssignments`, admin hooks, etc. The implementation work is to audit and add missing `invalidateQueries` calls to hooks that currently lack them.

**Rationale**: No new infrastructure is needed. The TanStack Query `onSuccess` pattern is already established in the codebase. The gap is that many older hooks (particularly `useFeeCampaigns`, `useFeeRules`, `useStaffAttendanceData`, `useChargeBatchRollback`, `useFeeStructure`, `useWorkHours`) use a manual `useState`+`useEffect`+`dataCache` Map pattern rather than TanStack Query. These hooks are outside the query cache and cannot benefit from `queryClient.invalidateQueries`.

**Alternatives considered**:
- Migrating all manual hooks to TanStack Query as part of this feature — More complete but significantly increases scope. Out of scope for v1; tracked as a known limitation.
- A global mutation interceptor on the Axios instance — Would catch all API calls but cannot know which query keys to invalidate per-call without domain knowledge. Too blunt.

---

## Decision 5: Manual Refresh Hook Implementation

**Decision**: Create a `useGlobalRefresh()` hook in `src/hooks/useGlobalRefresh.ts` that:
1. Exposes a `refreshAll()` function that calls `queryClient.refetchQueries({ type: 'active' })`.
2. Exposes `isRefreshing` derived from `useIsFetching() > 0`.

The `AppHeader` component imports this hook and renders the refresh button using its state.

**Rationale**: Keeping the refresh logic in a dedicated hook follows the project constitution's convention (Principle VII: complex logic in custom hooks, not page components). The hook is reusable and testable independently.

---

## Decision 6: Hooks Outside TanStack Query (Known Scope Limitation)

**Decision**: The following hooks use manual `useState`+`useEffect`+`Map` cache patterns and are **out of scope** for automatic post-action refresh in this feature:
- `useStaffAttendanceData.ts` (staff, attendance, leave data)
- `useFeeCampaigns.ts` (fee campaigns)
- `useFeeRules.ts` (fee rules, billing)
- `useChargeBatchRollback.ts` (charge batch rollback)
- `useFeeStructure.ts` (fee structure)
- `useWorkHours.ts` (work hours config)

These hooks have their own internal `refetch` / `loadAll` functions and already trigger re-fetches after their own mutations. Manual navbar refresh (`refetchQueries({ type: 'active' })`) also **does not cover** these hooks since they are not registered in the TanStack Query cache.

**Impact**: Pages using these hooks (Staff Attendance, Fee Campaigns, Fee Rules) will not auto-refresh after actions or respond to the navbar refresh button. The navbar button will still refresh all TanStack Query-backed queries on those pages.

**Recommended follow-up** (not in this feature's scope): Migrate these hooks to TanStack Query in a future "Standardise Query Layer" cleanup feature.

---

## Decision 7: Domain Query Key Groups for Automatic Invalidation

**Decision**: Define logical domain groups for `invalidateQueries` in `onSuccess` handlers. The mapping is:

| Domain | Query Key Prefix(es) |
|--------|---------------------|
| Students | `['students']`, `['student-balance']`, `['student-status-history']`, `['student-transport-history']`, `['student-class-attendance-summary']` |
| Payments | `['payments']`, `['student-balance']` |
| Transport | `['transport-routes']`, `['transport-allocations']`, `['missing-transport-charges']`, `['student-transport-history']` |
| Attendance (student) | `['attendance-today']`, `['attendance-summary']`, `['class-attendance-register']`, `['class-attendance-summary']`, `['session-attendance-summary']`, `['attendance-audit-log']` |
| Classes | `['classes']`, `['class-attendance-summary']` |
| Dashboard | `['dashboard', 'aggregation']` |
| Settings | `['settings']` |
| Subscription | `['subscription-plans']`, `['subscription-current']`, `['subscription']` |
| Staff (TanStack only) | `['staff-attendance-report']`, `['staff-attendance-department']` |

**Rationale**: These prefixes match the `queryKey` first-element conventions already in use across all TanStack Query hooks in the codebase.

---

## Decision 8: Error Handling for Manual Refresh

**Decision**: If `refetchQueries` encounters one or more failing queries, the button returns to idle and a toast notification is shown (e.g., "Some data could not be refreshed"). Existing cached data is preserved — TanStack Query does not clear cache on failed refetch by default.

**Rationale**: TanStack Query's default behaviour on refetch failure is to keep stale data and set `isError: true` on the failing query. No additional error clearing logic needed. The toast satisfies FR-006.
