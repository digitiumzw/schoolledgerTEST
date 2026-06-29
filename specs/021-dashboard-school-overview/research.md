# Research Findings: Dashboard School Overview

**Date**: 2026-04-08  
**Feature**: Dashboard School Overview  
**Phase**: 0 - Research Complete

## Responsive Dashboard Layout with shadcn/ui

**Decision**: Use CSS Grid with responsive breakpoints and the Card component as the base tile structure.

**Rationale**: 
- The existing dashboard already uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` which provides a solid foundation
- shadcn/ui's Card component offers consistent styling with proper header/content separation
- CSS Grid provides better control over responsive behavior than Flexbox for tile layouts

**Implementation Pattern**:

```tsx
<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
  <MetricTile /> // Individual tile components
</div>
```

**Alternatives considered**: 
- Flexbox: Less suitable for 2D grid layouts with varying tile sizes
- Custom grid system: Unnecessary complexity when CSS Grid is widely supported

## TanStack Query for Real-time Dashboard Data

**Decision**: Use TanStack Query with `refetchInterval` for periodic updates and `queryClient.invalidateQueries` after mutations.

**Rationale**:
- The existing codebase already uses TanStack Query (formerly React Query) for server state
- Automatic refetching ensures dashboard stays up-to-date without full page reloads
- Built-in loading and error states simplify component logic

**Implementation Pattern**:

```tsx
const { data: stats, isLoading, error, refetch } = useQuery({
  queryKey: ['dashboardStats'],
  queryFn: api.getDashboardStats,
  refetchInterval: 30000, // 30 seconds
});

// After quick action mutation
queryClient.invalidateQueries(['dashboardStats']);
```

**Alternatives considered**:
- Manual polling: More boilerplate and error-prone
- WebSocket: Overkill for this use case; adds infrastructure complexity

## Efficient Aggregation Queries in CodeIgniter/MySQL

**Decision**: Extend the existing `DashboardController::stats()` method with optimized single-query aggregations.

**Rationale**:
- The current endpoint already returns most required metrics
- The `LedgerService::getAllBalances()` method demonstrates the correct subquery pattern for performance
- Single query with conditional aggregations prevents N+1 query problems

**Implementation Pattern**:

```sql
SELECT
  SUM(CASE WHEN balance <= 0 THEN 1 ELSE 0 END) AS paid_in_full,
  SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) AS with_outstanding,
  -- Other aggregations
FROM (
  -- Subquery using LedgerService pattern
) AS student_balances
```

**Alternatives considered**:
- Multiple queries: Would cause N+1 performance issues
- Stored procedures: Adds deployment complexity and reduces visibility

## Component Composition for Modular Dashboard Sections

**Decision**: Create self-contained section components with uniform loading/error state handling.

**Rationale**:
- Each section (Financial, Enrolment, Staff, etc.) has distinct data requirements
- Uniform error handling improves user experience
- Easier to test and maintain individual sections

**Implementation Pattern**:

```tsx
<DashboardSection title="Financial Summary" loading={loading} error={error}>
  <FinancialSection data={stats.financial} />
</DashboardSection>
```

**Alternatives considered**:
- Monolithic component: Harder to maintain and test
- Render props pattern: Unnecessary abstraction for this use case

## Additional Technical Findings

### Existing API Endpoint Analysis
- Current `/api/dashboard/stats` already returns 14 metrics
- Missing: `pendingLeaveRequests`, `lowAttendanceStudents`
- The endpoint uses proper tenant filtering via `$this->getTenantId()`

### Frontend State Management
- Current dashboard uses `useState` for local state
- Already has skeleton loading states
- Quick actions trigger `fetchDashboardData()` for refresh

### Role-based Access
- Teacher dashboard already exists and separate from admin view
- Role checking happens at component level: `if (user?.role === 'teacher')`
- Backend will need to filter data based on role in the extended endpoint

## Key Technical Constraints Identified

1. **Must use existing `LedgerService::getAllBalances()` pattern** for financial calculations
2. **Must maintain tenant isolation** in all new queries
3. **Should not create new database migrations** - using existing schema only
4. **Must preserve existing teacher dashboard** functionality
5. **Quick actions must trigger dashboard refresh** after successful operations

## Performance Considerations

- Dashboard loads within 3 seconds requirement
- Skeleton loaders appear within 300ms
- Single aggregation query to prevent N+1 issues
- Consider implementing caching for expensive aggregations if needed

## Next Steps

With research complete, proceed to Phase 1: Design & Contracts
- Create data-model.md with entity definitions
- Define API contracts for extended endpoints
- Update agent context with new dashboard patterns
