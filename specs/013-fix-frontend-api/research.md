# Research: Fix Frontend Bugs and Replace MockApi

**Branch**: `013-fix-frontend-api` | **Date**: 2026-04-07

---

## 1. mockApi Module Status

**Decision**: `@/api/mockApi` does not exist as a file on disk. It was never created (or was deleted). All imports from it produce `Module not found` runtime errors.  
**Rationale**: Confirmed by `Glob` search — only `frontend/src/api/api.ts` exists under `src/api/`.  
**Alternatives considered**: Creating a shim `mockApi.ts` that re-exports from `api`. Rejected — adds dead code and obscures the actual fix.

---

## 2. Mapping mockApi → real api.ts (per affected file)

### 2.1 Dashboard.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.getDashboardStats()` | `api.getDashboardStats()` | Direct 1:1 |
| `mockApi.getRecentPayments(5)` | `api.getRecentPayments(5)` | Direct 1:1 |
| `mockApi.getPendingLeaveRequests()` | `api.getPendingLeaveRequests()` | Direct 1:1 |
| `mockApi.getClasses()` (teacher section) | `api.getClasses()` | Direct 1:1 |
| `mockApi.getStudentsByClassId(id)` | `api.getStudentsByClass(id)` | Renamed method |
| `mockApi.getClassAttendanceSummary(id, start, end)` | Compute client-side from `api.getStudentAttendance({classId})` | No dedicated backend endpoint; same computation already exists in `Attendance.tsx::fetchAttendanceSummary` |

### 2.2 Attendance.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.getClasses()` | `api.getClasses()` | Direct 1:1 |
| `mockApi.getStudentsByClassId(id)` | `api.getStudentsByClass(id)` | Renamed method |
| `mockApi.getAttendanceByClassAndDate(classId, date)` | `api.getStudentAttendance({ classId, date })` | Filter params match backend |
| `mockApi.getStudentAttendance({classId, recordedBy?})` | `api.getStudentAttendance({classId, recordedBy?})` | Direct 1:1 |
| `mockApi.saveAttendanceRecords(records, userId)` | `api.saveStudentAttendance(records)` | Drop `userId` — backend derives from JWT |

### 2.3 ManualAttendanceModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.getStaff()` | `api.getStaff()` | Direct 1:1 |
| `mockApi.updateStaffAttendance(id, data)` | `api.updateStaffAttendance(id, data)` | Direct 1:1 |
| `mockApi.recordStaffAttendance(data)` | `api.recordStaffAttendance(data)` | Backend route `POST /staff-attendance` exists; add method to api.ts |

### 2.4 StaffFormModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.updateStaff(id, data)` | `api.updateStaff(id, data)` | Direct 1:1 |
| `mockApi.createStaff(data)` | `api.createStaff(data)` | Direct 1:1 |

### 2.5 ReviewLeaveModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.getStaff()` | `api.getStaff()` | Direct 1:1 |
| `mockApi.reviewLeaveRequest(id, status, reviewedBy, notes)` | `api.reviewLeaveRequest(id, status, reviewedBy, notes)` | Direct 1:1 |

### 2.6 EditLeaveRequestModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.getCalendar()` | `api.getCalendar()` | Direct 1:1 |
| `mockApi.updateLeaveRequest(id, data)` | `api.updateLeaveRequest(id, data)` | Direct 1:1 |

### 2.7 DeleteClassModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.deleteClass(id)` | `api.archiveClass(id)` | Backend `DELETE /classes/:id` routes to `ClassController::archive`; "archive" is the correct semantic |

### 2.8 DeleteRouteModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.deleteRoute(id)` | `api.deleteRoute(id)` | Direct 1:1 |

### 2.9 AssignStudentsToRouteModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.getStudentsWithRouteStatus(routeId, term)` | `api.getStudentsWithRouteStatus(routeId, term)` | New backend endpoint required |

Also already calls `api.previewTransportCharges` and `api.assignStudentsWithCharges` — both missing from `api.ts` (and backend).

### 2.10 TransportAssignmentStatusModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.getTransportAssignmentsWithDetails(routeId)` | `api.getTransportAssignmentsWithDetails(routeId)` | New backend endpoint required |
| `mockApi.recordTransportPayment(data)` | `api.recordTransportPayment(data)` | New backend endpoint required |

### 2.11 TransportReportModal.tsx

| mockApi call | Replacement | Notes |
|---|---|---|
| `mockApi.getRoutes()` | `api.getRoutes()` | Direct 1:1 |
| `mockApi.getTransportAssignmentsWithDetails(routeId, term)` | `api.getTransportAssignmentsWithDetails(routeId, month)` | New backend endpoint required |

---

## 3. Backend Gap Analysis

### 3.1 `POST /api/staff-attendance` — recordStaffAttendance

**Decision**: Backend route already exists (`$routes->post('staff-attendance', 'AttendanceController::recordStaffAttendance')`). Only need to add the method to `api.ts`.  
**Payload**: `{ staffId, date, checkIn?, checkOut?, status, remarks?, workHours? }`

### 3.2 `GET /transport/routes/:routeId/students-with-status`

**Decision**: New backend method in `TransportController`. Queries all students in the tenant and cross-references with `transport_assignments` table to assign status.  
**Response**: Array of `{ id, firstName, lastName, className, routeStatus, assignedRouteName }`  
**Rationale**: Frontend modal needs three-state status per student. No existing endpoint provides this view.

### 3.3 `GET /transport/routes/:routeId/assignments`

**Decision**: New backend method in `TransportController`. Queries `transport_assignments` joined with students and routes, optionally filtered by month.  
**Response**: Array of `AssignmentStudent` matching the TypeScript interface in `TransportAssignmentStatusModal.tsx`.  
**Rationale**: Frontend needs payment/access status per assigned student. Existing driver roster endpoint is role-restricted to drivers.

### 3.4 `POST /transport/payment`

**Decision**: New backend endpoint. Records a payment in the `payments` table for a transport fee.  
**Payload**: `{ studentId, routeId, month, amount, method, notes? }`  
**Rationale**: `TransportAssignmentStatusModal` and `TransportPaymentModal` both need to persist payments. Re-uses the existing `payments` table, consistent with Principle V.

### 3.5 `POST /transport/routes/:routeId/assign-with-charges`

**Decision**: New backend endpoint. Assigns students to route AND generates charge records for the date range. Combines the existing `assignStudents` logic with new charge creation.  
**Payload**: `{ studentIds: string[], startDate: string, endDate: string }`  
**Response**: `{ createdAssignments, createdCharges, totalAmount }`

### 3.6 `POST /transport/routes/:routeId/preview-charges`

**Decision**: New backend endpoint. Calculates what charges would be generated for a given route and date range without persisting anything. Uses the route's `monthly_fee` to project.  
**Payload**: `{ routeId, startDate, endDate }`  
**Response**: `{ routeFee, durationMonths, totalAmount, startDate, endDate, charges: [{month, amount, isProrated}] }`

---

## 4. Constitution Compliance Verification

**Principle I** — All new backend methods will start with `$tenantId = $this->getTenantId()` and filter all queries by `tenant_id`. This is mandatory.

**Principle II** — Replacing in-memory mockApi with real HTTP calls is the direct implementation of this principle.

**Principle III** — New routes are added inside the `$routes->group('api', ...)` block, after the auth-exempt kiosk routes. `JWTAuthFilter` applies globally to `/api/*` via `Filters.php`. Transport endpoints will require `admin` or `super_admin` role consistent with existing transport controller methods.

**Principle V** — Transport payment uses the `payments` table. The `recordTransportPayment` endpoint creates a standard payment record. No balance column is stored; balance remains computed from `charges - payments`.

---

## 5. Pre-existing deviations (not fixed in this scope)

- **`api.ts` uses `fetch`, not Axios**: Constitution says Axios. This is a pre-existing architectural decision. The current production code works with fetch. Not in scope.
- **Pages use `useEffect + useState` instead of React Query**: Constitution mandates React Query for server state. These pages predate the constitution adoption. Migration is a separate task, not in scope.
- **`saveAttendanceRecords` drops `userId` param**: The old mockApi accepted a userId to tag who recorded attendance. The real backend derives this from the JWT. The param is simply dropped at the call site.
