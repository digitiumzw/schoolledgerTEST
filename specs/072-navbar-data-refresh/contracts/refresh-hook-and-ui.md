# Contracts: Navbar Data Refresh

**Feature**: 072-navbar-data-refresh  
**Date**: 2026-05-13

---

## 1. `useGlobalRefresh` Hook Contract

**File**: `frontend/src/hooks/useGlobalRefresh.ts`

### Interface

```typescript
interface UseGlobalRefreshReturn {
  isRefreshing: boolean;
  refreshAll: () => void;
}
```

### Behaviour

| Scenario | Expected |
|----------|----------|
| `refreshAll()` called, no active queries | No-op; `isRefreshing` stays `false` |
| `refreshAll()` called with active queries | Calls `queryClient.refetchQueries({ type: 'active' })`; `isRefreshing` becomes `true` until all settle |
| `refreshAll()` called while already refreshing | Guard: `isRefreshing === true` so button is disabled; second call is not triggered |
| Any active query finishes fetching | `isRefreshing` returns to `false` once `useIsFetching()` drops to `0` |

### Dependencies

- `useQueryClient()` — to call `refetchQueries`
- `useIsFetching()` — to derive `isRefreshing`

---

## 2. Navbar Refresh Button UI Contract

**Component**: `AppHeader` (modified)  
**File**: `frontend/src/components/AppHeader.tsx`

### Visual States

| State | Icon | Tooltip | Disabled |
|-------|------|---------|----------|
| Idle | `RefreshCw` (static) | "Refresh data" | No |
| Refreshing | `RefreshCw` with `animate-spin` class | "Refreshing..." | Yes |

### Placement

Rendered between the theme toggle button and the logout button in the right-side control group of the header. Uses the same `variant="ghost"`, `size="icon"`, `className="h-9 w-9"` as existing header buttons.

### Accessibility

- `aria-label="Refresh data"` when idle
- `aria-label="Refreshing..."` when spinning
- `disabled` attribute set when `isRefreshing === true`

---

## 3. Automatic Post-Action Invalidation Contract

All `useMutation` hooks in `src/hooks/` and `src/admin/hooks/` that mutate tenant data MUST include a `queryClient.invalidateQueries` call in their `onSuccess` handler targeting the domain key group(s) relevant to the affected data.

### Standard Pattern

```typescript
const mutation = useMutation({
  mutationFn: (input) => api.someAction(input),
  onSuccess: (_data, variables) => {
    // Invalidate affected domain(s) only
    queryClient.invalidateQueries({ queryKey: ['domain-prefix'] });
    // Optionally invalidate a related domain
    queryClient.invalidateQueries({ queryKey: ['related-domain-prefix', variables.entityId] });
    toast({ title: 'Action completed' });
  },
  onError: (err) => {
    // NO invalidation on error — existing data preserved
    toast({ title: 'Action failed', variant: 'destructive' });
  },
});
```

### Domain Invalidation Mapping

| Mutation Type | Invalidate Query Keys |
|--------------|----------------------|
| Create/update/delete student | `['students']`, `['student-balance', studentId]` |
| Record payment | `['payments']`, `['student-balance', studentId]` |
| Create/update transport assignment | `['transport-routes']`, `['transport-allocations']`, `['student-transport-history', studentId]` |
| Remove/reassign transport | `['transport-routes']`, `['transport-allocations']`, `['missing-transport-charges']`, `['student-transport-history', studentId]` |
| Submit class attendance | `['class-attendance-register']`, `['class-attendance-summary']` |
| Change student status | `['students']`, `['student-status-history', studentId]` |
| Create/update class | `['classes']` |
| Update settings | `['settings']` |
| Dashboard refresh | `['dashboard', 'aggregation']` |
| Staff attendance report actions | `['staff-attendance-report']`, `['staff-attendance-department']` |

### Scope Note

This contract applies only to **TanStack Query mutation hooks**. Manual `useState`-based hooks (`useFeeCampaigns`, `useFeeRules`, `useStaffAttendanceData`, etc.) are out of scope and continue to self-manage their state via internal `loadX()` calls.
