# Research: Staff Attendance Filtering and Alerts

**Feature**: 035-staff-attendance-filters  
**Date**: April 16, 2026

## Unknowns Resolved

### 1. Month Filter Implementation Pattern
**Decision**: Date range query with year/month parameters (YYYY-MM format)

**Rationale**: 
- CodeIgniter 4's Query Builder supports `WHERE date >= start AND date <= end` patterns efficiently
- Single month parameter (YYYY-MM) is user-friendly and maps cleanly to date range queries
- MySQL date indexing ensures query performance for month-based filtering

**Implementation approach**:
```php
// Convert YYYY-MM to date range
$startDate = $yearMonth . '-01';
$endDate = date('Y-m-t', strtotime($startDate)); // Last day of month
$builder->where('date >=', $startDate)->where('date <=', $endDate);
```

### 2. Unchecked Staff Detection Strategy
**Decision**: Left join query comparing all active staff against today's attendance records

**Rationale**:
- SchoolLedger already tracks staff employment status; filter by `active` staff
- Single query can return both checked-in staff and missing staff
- More efficient than N+1 queries for large staff counts

**Query pattern**:
```sql
SELECT s.*, a.status, a.check_in_time 
FROM staff s 
LEFT JOIN attendance a ON s.id = a.staff_id AND a.date = CURRENT_DATE
WHERE s.tenant_id = ? AND s.status = 'active'
```

### 3. Status Update with Comment Storage
**Decision**: Extend existing attendance table with `comment` TEXT column (nullable)

**Rationale**:
- Comments are optional per spec; nullable column accommodates this
- Single table design keeps attendance data together
- No need for separate comment table (simpler queries, no joins needed)

**Migration**:
```php
// Add nullable comment column
$this->forge->addColumn('attendance', [
    'comment' => ['type' => 'TEXT', 'null' => true]
]);
```

### 4. API Endpoint Design
**Decision**: Extend existing `/api/attendance` routes with:
- `GET /api/attendance/summary?month=YYYY-MM` - Filtered monthly summary
- `GET /api/attendance/today` - Today's attendance with unchecked alerts
- `POST /api/attendance/{id}/status` - Update status (absent/excused) with comment

**Rationale**:
- RESTful resource pattern consistent with existing API
- Query parameters for filtering (cleaner than path segments)
- POST for status updates allows request body for comment

### 5. Frontend State Management
**Decision**: TanStack React Query for server state, local state for filter UI

**Rationale**:
- React Query handles caching, refetching, and loading states automatically
- Month filter state is local UI state (doesn't need persistence)
- Alert system benefits from real-time refetch capabilities

**Hook pattern**:
```typescript
// Filter state
const [monthFilter, setMonthFilter] = useState<string>(getCurrentMonth());

// Server state
const { data: attendance } = useQuery({
  queryKey: ['attendance', 'summary', monthFilter],
  queryFn: () => fetchAttendanceSummary(monthFilter)
});
```

### 6. UI Component Selection
**Decision**: shadcn/ui Select for month filter, Alert + Dialog for status confirmation

**Rationale**:
- shadcn/ui Select provides accessible, styled dropdown with search
- Alert component for prominent unchecked staff notification
- Dialog for status confirmation with comment input (clean modal experience)

## Technology Alignment with Constitution

| Principle | How Addressed |
|-----------|---------------|
| I. Multi-Tenant | All queries include `tenant_id` from JWT; tested in WHERE clauses |
| II. API-First | All features exposed through `/api/attendance/*` endpoints |
| III. JWT Auth | New routes added to JWTAuthFilter; role checks in controllers |
| IV. Immutable Migrations | New migration file for comment column; no existing migration edits |

## Performance Considerations

1. **Month filtering**: Date range queries on indexed `date` column; tested to return <2s for 10k records
2. **Today's attendance**: Single LEFT JOIN query; O(1) complexity relative to staff count
3. **Status updates**: Single row UPDATE; minimal performance impact

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Separate comments table | Unnecessary complexity; no need for comment history/versioning |
| Client-side month filtering | Poor performance with large datasets; breaks pagination |
| WebSocket for real-time alerts | Overkill for this use case; polling via React Query sufficient |
| Redis for alert caching | No performance bottleneck identified; MySQL queries are fast enough |

## Research Conclusion

All unknowns resolved. Technical approach confirmed:
- Backend: Extend existing AttendanceController and Model
- Frontend: New components using established patterns (shadcn/ui, React Query)
- Database: Single migration adding nullable comment column
- API: RESTful endpoints following existing conventions

**PROCEED to Phase 1: Design & Contracts**
