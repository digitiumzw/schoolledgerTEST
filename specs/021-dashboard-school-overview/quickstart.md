# Quick Start Guide: Dashboard School Overview

**Date**: 2026-04-08  
**Feature**: Dashboard School Overview  
**Phase**: 1 - Design & Contracts

## Overview

This guide helps developers quickly understand and work with the redesigned dashboard feature. The dashboard provides a comprehensive school overview with financial, enrolment, staff, transport, and alert metrics.

## Prerequisites

- PHP 8.1+ with CodeIgniter 4
- MySQL database
- Node.js 18+ with React 18
- Existing SchoolLedger installation

## Architecture Summary

```
Frontend (React)
├── Dashboard.tsx - Main page component
├── components/dashboard/ - Modular section components
├── hooks/useDashboardStats.ts - Data fetching with TanStack Query
└── api/api.ts - API client

Backend (PHP/CodeIgniter)
├── Controllers/Api/DashboardController.php - Stats endpoint
├── Services/LedgerService.php - Financial calculations
└── Models/ - Existing data models
```

## Key Components

### 1. Dashboard Sections

Each section is a self-contained component:

```tsx
// Financial Section Example
<FinancialSection 
  data={stats.financial}
  loading={loading}
  error={error}
  onRetry={refetch}
/>
```

Available sections:

- `FinancialSection` - Revenue, collection rate, balances
- `EnrolmentSection` - Student counts, class metrics
- `StaffSection` - Staff counts, leave requests
- `TransportSection` - Routes and student usage
- `ActivityFeed` - Recent payments and leave requests
- `QuickActions` - Common task shortcuts

### 2. Responsive Grid Layout

```tsx
<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
  <MetricTile title="Total Students" value={totalStudents} />
  <MetricTile title="Outstanding Fees" value={formatCurrency(outstanding)} />
  <!-- More tiles... -->
</div>
```

### 3. Real-time Updates

```tsx
const { data: stats, isLoading, error, refetch } = useQuery({
  queryKey: ['dashboardStats'],
  queryFn: api.getDashboardStats,
  refetchInterval: 30000, // Auto-refresh every 30 seconds
});

// Manual refresh after actions
const handlePaymentSuccess = () => {
  queryClient.invalidateQueries(['dashboardStats']);
};
```

## API Endpoints

### Get Dashboard Stats

```http
GET /api/dashboard/stats
Authorization: Bearer <JWT>

Response:
{
  "success": true,
  "data": {
    "totalStudents": 150,
    "totalOutstanding": 15000.00,
    "collectionRate": 85.5,
    "pendingLeaveRequests": 3,
    // ... more metrics
  }
}
```

### Get Recent Activity
```http
GET /api/dashboard/activity?limit=10
Authorization: Bearer <JWT>

Response:
{
  "success": true,
  "data": {
    "activities": [
      {
        "type": "payment",
        "description": "Payment received: $500.00",
        "timestamp": "2026-04-08T14:30:00Z",
        "relativeTime": "2 minutes ago"
      }
      // ... more activities
    ]
  }
}
```

## Development Workflow

### 1. Backend Changes

Extend `DashboardController::stats()`:

```php
public function stats()
{
    $tenantId = $this->getTenantId();
    
    // Existing metrics...
    
    // NEW: Alert metrics
    $pendingLeaves = $db->table('leave_requests')
        ->where('tenant_id', $tenantId)
        ->where('status', 'pending')
        ->countAllResults();
        
    $lowAttendance = $db->table('attendance')
        ->where('tenant_id', $tenantId)
        ->where('attendance_percentage <', 75)
        ->countDistinctResults('student_id');
    
    return $this->success([
        // ... existing fields
        'pendingLeaveRequests' => (int) $pendingLeaves,
        'lowAttendanceStudents' => (int) $lowAttendance,
    ]);
}
```

### 2. Frontend Component Structure

```tsx
// components/dashboard/MetricTile.tsx
interface MetricTileProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

export function MetricTile({ title, value, icon: Icon, description }: MetricTileProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. Adding New Metrics

1. **Backend**: Add aggregation to `DashboardController::stats()`
2. **Frontend**: Update `DashboardStats` type in `types/dashboard.ts`
3. **UI**: Add metric to appropriate section component

## Testing

### Backend Tests

```php
// Tests/Controllers/DashboardControllerTest.php
public function testStatsReturnsCorrectMetrics()
{
    // Create test data
    $this->createTestStudents();
    $this->createTestPayments();
    
    // Call endpoint
    $response = $this->get('/api/dashboard/stats');
    
    // Assert response
    $response->assertStatus(200);
    $response->assertJson([
        'success' => true,
        'data' => [
            'totalStudents' => 5,
            'collectionRate' => 80.0,
        ]
    ]);
}
```

### Frontend Tests

```tsx
// components/dashboard/__tests__/FinancialSection.test.tsx
test('renders financial metrics correctly', () => {
  const mockStats = {
    totalOutstanding: 15000,
    collectionRate: 85.5,
    paidInFull: 100,
  };
  
  render(<FinancialSection data={mockStats} loading={false} />);
  
  expect(screen.getByText('$15,000.00')).toBeInTheDocument();
  expect(screen.getByText('85.5%')).toBeInTheDocument();
});
```

## Common Patterns

### 1. Error Handling

```tsx
if (error) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Error loading dashboard</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
      <Button onClick={refetch} size="sm">Retry</Button>
    </Alert>
  );
}
```

### 2. Loading States

```tsx
if (isLoading) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 3. Role-Based Rendering

```tsx
{user?.role !== 'teacher' && (
  <FinancialSection data={stats} />
)}

{user?.role === 'admin' && (
  <StaffSection data={stats.staff} />
)}
```

## Performance Tips

1. **Use React.memo** for metric tiles to prevent unnecessary re-renders
2. **Debounce refresh** after quick actions to avoid excessive API calls
3. **Virtualize lists** if activity feed grows beyond 50 items
4. **Lazy load** non-critical sections below the fold

## Troubleshooting

### Common Issues

1. **Dashboard shows 0 for all metrics**
   - Check JWT contains valid `tenant_id`
   - Verify database connection
   - Check query logs for errors

2. **Metrics don't update after payment**
   - Ensure `queryClient.invalidateQueries()` is called
   - Check API response caching headers
   - Verify backend query is not cached

3. **Teacher sees admin data**
   - Check role filtering in backend controller
   - Verify JWT `role` claim is correct
   - Check frontend conditional rendering

### Debug Commands

```bash
# Check dashboard API response
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8080/api/dashboard/stats

# Monitor database queries
tail -f logs/sql.log | grep "dashboard"

# Check frontend network requests
# Open DevTools > Network > Filter: /api/dashboard
```

## Next Steps

1. Review the full implementation in `tasks.md`
2. Run the test suite to verify functionality
3. Check responsive design on various screen sizes
4. Monitor performance with realistic data volumes
