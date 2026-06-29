# Quickstart: Transport Constraints Development

**Feature**: 054-transport-constraints  
**Branch**: `054-transport-constraints`

## Prerequisites

- PHP 8.1+
- MySQL 5.7+ or 8.0+
- Node.js 18+
- Existing SchoolLedger development environment configured

## Setup Steps

### 1. Checkout Feature Branch

```bash
git checkout 054-transport-constraints
```

### 2. Install Dependencies

```bash
# Backend
cd backend
composer install

# Frontend
cd ../frontend
npm install
```

### 3. Run Migrations

```bash
cd backend
php spark migrate
```

This applies the transport constraints migration:
- Adds `is_active` generated column to `transport_student_allocations`
- Creates unique index to enforce single active assignment per student
- Adds supporting indexes for performance

### 4. Verify Database State

```sql
-- Check constraints are in place
SHOW INDEX FROM transport_student_allocations;

-- Should see:
-- - idx_unique_active_assignment (unique)
-- - idx_alloc_route_status
-- - idx_alloc_student
-- - idx_stop_route
```

### 5. Seed Test Data (Optional)

```bash
cd backend
php spark db:seed TransportConstraintTestSeeder
```

This creates:
- 3 routes with stops
- 10 students (mix of active and non-active)
- Sample transport assignments
- Some students with missing charges for testing alerts


## Key Development Workflows

### Adding a New Transport Assignment

1. Navigate to Transport Routes page (`/transport/routes`)
2. Click on a route to view details
3. Click "Assign Student"
4. Select student from dropdown (only students without active assignments shown)
5. Select stop from route's configured stops
6. Submit

**Expected behavior**:
- Success: Student appears on route roster
- Conflict (already assigned): Error message shows current route
- Missing stop: Validation error requires stop selection

### Testing Reassignment

1. Find a student with an active assignment
2. Click "Reassign" on their current route
3. Select target route and stop
4. Select reassignment date
5. Submit

**Expected behavior**:
- Old assignment shows end date
- New assignment appears on target route
- Both visible in student's transport history

### Testing Auto-Deallocation

1. Find a student with active transport assignment
2. Go to student profile
3. Change status from "active" to "withdrawn"
4. Check transport history - assignment should be inactive with end_date set

### Testing Missing Charge Alerts

1. Create a transport assignment for current month
2. Do NOT generate charges for that student
3. Go to Transport Dashboard
4. Alert should show "1 student missing transport charges"
5. Click alert to see list
6. Generate charges
7. Alert should disappear

## API Testing with curl

### Test Assignment Constraint

```bash
# Try to assign already-assigned student (should fail with 409)
curl -X POST http://localhost:8080/api/transport/routes/route_123/allocations \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_already_assigned",
    "stopId": "stop_456"
  }'
```

### Test Reassignment

```bash
curl -X POST http://localhost:8080/api/transport/allocations/reassign \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_456",
    "fromRouteId": "route_123",
    "toRouteId": "route_789",
    "toStopId": "stop_999",
    "reassignDate": "2026-05-01"
  }'
```

### Get Missing Charges

```bash
curl "http://localhost:8080/api/transport/missing-charges?month=2026-04" \
  -H "Authorization: Bearer <jwt>"
```

### Get Student Transport History

```bash
curl http://localhost:8080/api/students/student_456/transport-history \
  -H "Authorization: Bearer <jwt>"
```

## Common Issues

### Migration fails with "duplicate column"

```bash
# Rollback and re-apply
php spark migrate:rollback
php spark migrate
```

### 409 Conflict not returning existing route info

Check that `TransportAssignmentService::getExistingAssignment()` is returning the route details properly.

### Stop validation failing

Verify that:
1. Route has stops configured (`transport_stops` table)
2. Stop ID belongs to the route being assigned
3. Stop ID is included in the request body

### Auto-deallocation not triggering

Ensure status change is using `StudentModel` methods, not raw database queries. The hook is in `afterUpdate` event.

## Code Structure

```
backend/
├── app/
│   ├── Controllers/Api/
│   │   ├── TransportController.php    # createAllocation(), reassign(), getMissingCharges()
│   │   └── StudentController.php      # getTransportHistory()
│   ├── Services/
│   │   ├── TransportAssignmentService.php   # validateAssignment(), reassignStudent()
│   │   └── StudentStatusService.php         # handleStatusChange()
│   ├── Models/
│   │   ├── TransportStudentAllocationModel.php  # with validation rules
│   │   └── StudentModel.php                       # afterUpdate hook
│   └── Database/Migrations/
│       └── 2026-04-30-XXX_AddTransportConstraints.php
```

## Testing Checklist

- [ ] Cannot assign student to multiple routes simultaneously
- [ ] Reassignment atomically ends old + creates new assignment
- [ ] Stop validation rejects invalid stop IDs
- [ ] Stop validation rejects missing stop IDs
- [ ] Auto-deallocation triggers on status change to non-active
- [ ] No auto-deallocation on status change between non-active states
- [ ] Transport history shows all assignments (active and inactive)
- [ ] Missing charge alerts display correctly
- [ ] Missing charge alerts clear after charge generation
- [ ] Multi-tenant isolation prevents cross-tenant access
- [ ] All endpoints return consistent JSON envelopes

## Next Steps


3. Deploy to staging environment
4. Monitor error logs for constraint violations
5. Create PR with Constitution Check
