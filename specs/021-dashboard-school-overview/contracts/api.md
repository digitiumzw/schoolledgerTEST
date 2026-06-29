# API Contracts: Dashboard School Overview

**Date**: 2026-04-08  
**Feature**: Dashboard School Overview  
**Phase**: 1 - Design & Contracts

## Dashboard Stats API

### Endpoint: GET /api/dashboard/stats

Returns aggregated school metrics for the dashboard. Extended to include alert metrics.

#### Request Headers

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

#### Response Schema

```typescript
interface DashboardStatsResponse {
  success: true;
  data: {
    // Student Financial Stats
    totalStudents: number;
    paidInFull: number;
    withOutstanding: number;
    partialOrOverdue: number;
    totalOutstanding: number;
    
    // Financial Overview
    totalRevenueThisTerm: number;
    collectionRate: number;
    studentsOnBursary: number;
    totalBursarySavings: number;
    
    // School Overview
    totalClasses: number;
    averageClassSize: number;
    totalStaff: number;
    teachingStaff: number;
    activeTransportRoutes: number;
    studentsUsingTransport: number;
    
    // Alert Metrics (NEW)
    pendingLeaveRequests: number;
    lowAttendanceStudents: number;
  };
}
```

#### Role-Based Response Filtering

**Admin/Super Admin**: Returns all fields as shown above

**Bursar**: Returns all fields (assumes backend permits access)

**Teacher**: Returns HTTP 403 - Should use class-specific endpoints instead

#### Error Responses

```typescript
// 401 Unauthorized
{
  success: false,
  error: "Invalid or expired token"
}

// 403 Forbidden
{
  success: false,
  error: "Insufficient permissions"
}

// 500 Server Error
{
  success: false,
  error: "Failed to fetch dashboard stats"
}
```

## Recent Activity API

### Endpoint: GET /api/dashboard/activity

Returns the 10 most recent payment and leave request activities.

#### Request Parameters

```http
Optional query params:
?limit=10 (default: 10)
?type=payment|leave (filter by type)
```

#### Response Schema

```typescript
interface RecentActivityResponse {
  success: true;
  data: {
    activities: Array<{
      id: string;
      type: 'payment' | 'leave';
      description: string;
      detail: string;
      timestamp: string;        // ISO 8601
      relativeTime: string;     // "2 minutes ago"
      amount?: number;          // Payments only
      status?: string;          // Leave requests only
    }>;
  };
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "pay_123",
        "type": "payment",
        "description": "Payment received: $500.00",
        "detail": "Tuition fees",
        "timestamp": "2026-04-08T14:30:00Z",
        "relativeTime": "2 minutes ago",
        "amount": 500.00
      },
      {
        "id": "leave_456",
        "type": "leave",
        "description": "Leave request: Sick Leave",
        "detail": "2 days - pending",
        "timestamp": "2026-04-08T13:15:00Z",
        "relativeTime": "1 hour ago",
        "status": "pending"
      }
    ]
  }
}
```

## Quick Actions API

### Record Payment

**Endpoint**: POST /api/payments  
**Existing endpoint** - no changes needed

### Add Student

**Endpoint**: POST /api/students  
**Existing endpoint** - no changes needed

### Mark Attendance

**Endpoint**: POST /api/attendance/bulk  
**Existing endpoint** - no changes needed

## Teacher Dashboard APIs

### Get Teacher Classes

**Endpoint**: GET /api/classes/teacher  
**Existing endpoint** - returns classes assigned to teacher

### Get Class Attendance

**Endpoint**: GET /api/attendance/class/{classId}?start={date}&end={date}  
**Existing endpoint** - returns attendance records for date range

## Implementation Notes

### Backend Changes Required

1. **Extend DashboardController::stats()**

   - Add `pendingLeaveRequests` count from `leave_requests` table
   - Add `lowAttendanceStudents` calculation from `attendance` table
   - Maintain existing tenant filtering

2. **Create DashboardController::activity()**

   - New method for recent activity feed
   - Join payments and leave_requests tables
   - Order by timestamp DESC
   - Limit to 10 records by default

3. **Role Enforcement**

   - Add role checks in DashboardController methods
   - Teachers get 403 on stats endpoint
   - Use existing role data from JWT

### Frontend Integration

1. **Update API Client**

   ```typescript
   // Add to api.ts
   getDashboardActivity: (limit?: number, type?: string) => 
     api.get(`/dashboard/activity${limit ? `?limit=${limit}` : ''}${type ? `&type=${type}` : ''}`)
   ```

2. **Type Definitions**

   - Update `DashboardStats` interface in types/dashboard.ts
   - Add `RecentActivity` interface
   - Ensure all numeric fields handle null/undefined

## Performance Considerations

### Caching Strategy

- Dashboard stats: Cache for 30 seconds
- Recent activity: Cache for 10 seconds
- Invalidate cache on related mutations

### Query Optimization

- Single query for all stats aggregations
- Use indexes on timestamp fields for activity feed
- Leverage existing LedgerService optimizations

### Pagination

- Activity feed supports limit parameter
- Future: Add cursor-based pagination for infinite scroll

## Security Considerations

### Tenant Isolation

- All queries MUST include `tenant_id` filter
- Verified through existing JWT middleware

### Role Validation

- Backend enforces role-based data access
- Frontend role checks are UX only, not security

### Data Sanitization

- All numeric outputs validated
- Currency values formatted to 2 decimal places
- Percentages capped at 0-100 range
