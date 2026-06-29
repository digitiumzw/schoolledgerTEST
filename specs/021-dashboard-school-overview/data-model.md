# Data Model: Dashboard School Overview

**Date**: 2026-04-08  
**Feature**: Dashboard School Overview  
**Phase**: 1 - Design & Contracts

## Core Entities

### DashboardStats

Aggregated school metrics returned by the `/api/dashboard/stats` endpoint.

```typescript
interface DashboardStats {
  // Student Financial Stats
  totalStudents: number;           // Active enrolled students
  paidInFull: number;             // Students with zero balance
  withOutstanding: number;        // Students with positive balance
  partialOrOverdue: number;       // Students with balance > $100
  totalOutstanding: number;       // Sum of all outstanding balances
  
  // Financial Overview
  totalRevenueThisTerm: number;   // Revenue collected in current term
  collectionRate: number;         // Percentage of charges collected
  studentsOnBursary: number;      // Count of students with bursary
  totalBursarySavings: number;    // Total value of bursary discounts
  
  // School Overview
  totalClasses: number;           // Active class count
  averageClassSize: number;       // Average students per class
  totalStaff: number;             // Total active staff
  teachingStaff: number;          // Staff with teaching role
  activeTransportRoutes: number;  // Active transport routes
  studentsUsingTransport: number; // Students assigned to transport
  
  // Alert Metrics (NEW)
  pendingLeaveRequests: number;   // Staff leave requests pending
  lowAttendanceStudents: number;  // Students < 75% attendance
}
```

**Validation Rules**:
- All numeric values must be >= 0
- `collectionRate` must be 0-100, rounded to 1 decimal place
- `averageClassSize` rounded to 1 decimal place
- Currency values (`totalOutstanding`, `totalRevenueThisTerm`) use 2 decimal places

### RecentActivity

Unified feed item representing a payment or leave request.

```typescript
interface RecentActivity {
  id: string;
  type: 'payment' | 'leave';
  description: string;            // Human-readable description
  detail: string;                 // Additional context
  timestamp: string;              // ISO 8601 datetime
  relativeTime: string;           // "2 minutes ago" format
  amount?: number;                // Only for payments
  status?: string;                // Only for leave requests
}
```

**State Transitions**:
- Payment activities are immutable once created
- Leave requests transition: `pending` → `approved`/`rejected`

### TeacherDashboardData

Class-scoped data for teacher dashboard view.

```typescript
interface TeacherDashboardData {
  selectedClassId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  attendanceSummary: StudentAttendanceSummary[];
  classStats: {
    totalStudents: number;
    avgAttendance: number;
    perfectAttendance: number;
    lowAttendance: number;
  };
}

interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  totalDays: number;
  attendancePercentage: number;
}
```

**Validation Rules**:
- `attendancePercentage` rounded to nearest whole number
- All day counts must be >= 0
- `totalDays` = sum of all attendance status days

## Relationships

```
DashboardStats (aggregated)
├── Student (via tenant_id)
├── Payment (via tenant_id)
├── Charge (via tenant_id)
├── Staff (via tenant_id)
├── Class (via tenant_id)
└── TransportRoute/Assignment (via tenant_id)

RecentActivity
├── Payment (one-to-one)
└── LeaveRequest (one-to-one)

TeacherDashboardData
├── Class (selected)
└── StudentAttendance (many-to-one via Student)
```

## Data Sources

### Existing Tables (No Schema Changes)

1. **students** - Active student records

   - Filter: `status = 'active'`
   - Fields: `id`, `first_name`, `last_name`, `class_id`, `bursary_status`

2. **charges** - Fee and transport charges

   - Filter: `deleted_at IS NULL`
   - Used for balance calculations via LedgerService

3. **payments** - Payment records

   - Filter: By date range for term revenue
   - Used for balance calculations

4. **staff** - Staff records

   - Filter: `employment_status = 'active'`
   - Fields: `is_teaching` for staff type breakdown

5. **classes** - Class records

   - Count for total classes
   - Used for average class size calculation

6. **transport_routes** - Transport route definitions

   - Filter: `status = 'active'`

7. **transport_assignments** - Student transport assignments

   - Filter: `access = 1`

8. **leave_requests** - Staff leave requests

   - Filter: `status = 'pending'` for alert count

9. **attendance** - Student attendance records

   - Used for low attendance calculation (< 75%)

## Aggregation Logic

### Financial Metrics

```sql
-- Using LedgerService pattern
SELECT
  SUM(CASE WHEN balance <= 0 THEN 1 ELSE 0 END) AS paidInFull,
  SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) AS withOutstanding,
  SUM(CASE WHEN balance > 100 THEN 1 ELSE 0 END) AS partialOrOverdue,
  SUM(balance) AS totalOutstanding
FROM (subquery from LedgerService::getAllBalances)
```

### Collection Rate

```sql
-- (Total Payments / Total Charges) * 100
-- Handle division by zero: return 0 if no charges
```

### Attendance Alerts

```sql
-- Students with attendance < 75%
SELECT COUNT(DISTINCT student_id)
FROM attendance
WHERE date >= [term_start]
  AND attendance_percentage < 75
```

## Role-Based Data Filtering

### Admin/Super Admin

- Access to all metrics
- No additional filtering beyond tenant isolation

### Bursar

- Financial metrics: Full access
- Staff metrics: Full access (if backend permits)
- No restrictions

### Teacher

- Only sees TeacherDashboardData
- Sees only classes assigned to them
- No financial, staff, or transport data

## Error Handling

### Per-Section Error States

- Each dashboard section handles its own loading/error state
- Error includes retry functionality
- Failed sections don't prevent other sections from loading

### Data Validation

- Backend validates all aggregations
- Frontend gracefully handles missing/undefined values
- Zero values displayed as "0" not "NaN" or "undefined"

## Performance Considerations

### Query Optimization

- All aggregations in single query per API call
- Use existing LedgerService subquery pattern
- Consider caching for expensive calculations

### Frontend Rendering

- Skeleton loaders within 300ms
- Section-based rendering prevents blocking
- Lazy loading for non-critical sections
