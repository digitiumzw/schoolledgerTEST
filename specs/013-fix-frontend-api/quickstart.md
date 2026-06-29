# Quickstart: Fix Frontend Bugs and Replace MockApi

**Branch**: `013-fix-frontend-api`

## Prerequisites

- Backend running: `cd backend && php spark serve` (port 8080)
- Frontend running: `cd frontend && npm run dev` (port 8080 or as configured)
- Database seeded: `php spark db:seed CompleteDatabaseSeeder`
- Credentials: `admin@greenwood.co.zw` / `1234`

## Implementation Order

Complete changes in this order to keep the app functional at each step:

### Step 1: Add missing methods to `api.ts`

Add these 6 methods to `frontend/src/api/api.ts` in the Transport section and Staff Attendance section:

```typescript
// In STAFF ATTENDANCE section:
recordStaffAttendance: async (data: any) => {
  const response = await apiRequest('/staff-attendance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
},

// In TRANSPORT section:
getStudentsWithRouteStatus: async (routeId: string, term?: string) => {
  const params = new URLSearchParams();
  if (term) params.append('term', term);
  const qs = params.toString();
  const response = await apiRequest(`/transport/routes/${routeId}/students-with-status${qs ? '?' + qs : ''}`);
  return response.data;
},

getTransportAssignmentsWithDetails: async (routeId: string, month?: string) => {
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  const qs = params.toString();
  const response = await apiRequest(`/transport/routes/${routeId}/assignments${qs ? '?' + qs : ''}`);
  return response.data;
},

recordTransportPayment: async (data: any) => {
  const response = await apiRequest('/transport/payment', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
},

assignStudentsWithCharges: async (data: { routeId: string; studentIds: string[]; startDate: string; endDate: string }) => {
  const response = await apiRequest(`/transport/routes/${data.routeId}/assign-with-charges`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
},

previewTransportCharges: async (data: { routeId: string; startDate: string; endDate: string }) => {
  const response = await apiRequest(`/transport/routes/${data.routeId}/preview-charges`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
},
```

### Step 2: Add backend endpoints to TransportController.php

Add 5 new public methods to `backend/app/Controllers/Api/TransportController.php` and register their routes in `Routes.php`.

New routes to add in `Routes.php` (inside the api group, near existing transport routes):
```php
$routes->get('transport/routes/(:segment)/students-with-status', 'TransportController::getStudentsWithRouteStatus/$1');
$routes->get('transport/routes/(:segment)/assignments', 'TransportController::getAssignmentsWithDetails/$1');
$routes->post('transport/payment', 'TransportController::recordPayment');
$routes->post('transport/routes/(:segment)/assign-with-charges', 'TransportController::assignWithCharges/$1');
$routes->post('transport/routes/(:segment)/preview-charges', 'TransportController::previewCharges/$1');
```

### Step 3: Replace mockApi imports in each file

Replace import lines one file at a time:

```typescript
// Old:
import { mockApi } from "@/api/mockApi";

// New (adjust existing api import or add):
import { api } from "@/api/api";
```

Then replace each `mockApi.X(...)` call with the mapped `api.Y(...)` call per the research table.

### Step 4: Verify each page

After completing all replacements:
1. Dashboard — loads stats, payments, leaves (admin view); loads classes + attendance summary (teacher view)
2. Attendance — loads classes, students, existing records; saves records
3. Staff page — opens StaffFormModal, creates/edits staff
4. Staff Attendance — opens ManualAttendanceModal, creates/edits records
5. Leave Management — opens ReviewLeaveModal, EditLeaveRequestModal
6. Classes — opens DeleteClassModal
7. Transport — opens AssignStudentsToRouteModal, TransportAssignmentStatusModal, TransportReportModal, DeleteRouteModal

## Verification Commands

```bash
# Check for any remaining mockApi references
grep -rn "mockApi" frontend/src/ --include="*.ts" --include="*.tsx"
# Expected: 0 results

# TypeScript compile check
cd frontend && npx tsc --noEmit
# Expected: 0 errors
```
