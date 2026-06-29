# Implementation Plan: Fix Frontend Bugs and Replace MockApi

**Branch**: `013-fix-frontend-api` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/013-fix-frontend-api/spec.md`

## Summary

Eleven frontend files import from a non-existent `@/api/mockApi` module, causing runtime crashes. Additionally, several transport-specific API methods (`getTransportAssignmentsWithDetails`, `getStudentsWithRouteStatus`, `recordTransportPayment`, `assignStudentsWithCharges`, `previewTransportCharges`) are called from the frontend but have no matching endpoints in the backend or entries in `api.ts`. The fix involves: (1) replacing all `mockApi` imports with the real `api` object, adapting call signatures where needed; (2) adding missing methods to `api.ts`; and (3) adding the missing backend transport endpoints in `TransportController.php`.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript + React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend) · Vite + TailwindCSS + shadcn/ui + TanStack React Query (frontend)  
**Storage**: MySQL — existing `transport_routes`, `transport_assignments`, `staff_attendance`, `student_attendance`, `payments`, `charges` tables  
**Testing**: Manual integration testing against the running dev server  
**Target Platform**: Web SPA + CI4 REST API (localhost:8080 dev)  
**Project Type**: Full-stack web application (monorepo)  
**Performance Goals**: No new performance requirements; existing patterns preserved  
**Constraints**: No schema changes (no new migrations); no Redux/Zustand; React Query migration out of scope for this fix  
**Scale/Scope**: 11 files to patch; 5 backend endpoints to add; ~6 api.ts methods to add

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ Pass | All new backend endpoints will filter by `tenant_id` from JWT payload, consistent with existing controller pattern. No frontend change affects tenant filtering. |
| II. API-First Separation | ✅ Pass | This fix directly implements Principle II — removing in-memory mock calls and replacing them with real REST API calls. |
| III. JWT Authentication & RBAC | ✅ Pass | New backend routes are placed inside the JWT-filtered group in `Routes.php`. Role restrictions on transport endpoints match existing admin-only pattern. |
| IV. Immutable Migrations | ✅ Pass | No schema changes needed. All new endpoints query existing tables. |
| V. Financial Ledger Integrity | ✅ Pass | Transport payment recording flows through the existing `payments` table; balance recomputation is not affected. No ledger subquery pattern is altered. |
| Frontend API convention | ⚠️ Pre-existing deviation | Constitution requires Axios; `api.ts` uses native `fetch`. Pre-existing, out of scope for this fix. |
| React Query convention | ⚠️ Pre-existing deviation | Affected pages use `useEffect + useState` instead of React Query. Pre-existing, out of scope. Only `mockApi` → `api` wiring is in scope. |

## Complexity Tracking

> No constitution violations introduced by this feature. Pre-existing deviations documented above are not introduced by this change.

## Project Structure

### Documentation (this feature)

```text
specs/013-fix-frontend-api/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php                          # Add 5 new transport routes
│   └── Controllers/Api/
│       └── TransportController.php             # Add 5 new public methods

frontend/
└── src/
    ├── api/
    │   └── api.ts                              # Add ~6 missing methods
    ├── pages/
    │   ├── Dashboard.tsx                       # Replace mockApi → api
    │   └── Attendance.tsx                      # Replace mockApi → api + adapt signatures
    └── components/
        └── modals/
            ├── ManualAttendanceModal.tsx        # Replace mockApi → api
            ├── AssignStudentsToRouteModal.tsx   # Replace mockApi.getStudentsWithRouteStatus → api
            ├── EditLeaveRequestModal.tsx        # Replace mockApi → api
            ├── ReviewLeaveModal.tsx             # Replace mockApi → api
            ├── DeleteClassModal.tsx             # Replace mockApi.deleteClass → api.archiveClass
            ├── StaffFormModal.tsx               # Replace mockApi → api
            ├── TransportAssignmentStatusModal.tsx # Replace mockApi → api
            ├── TransportReportModal.tsx         # Replace mockApi → api
            └── DeleteRouteModal.tsx             # Replace mockApi → api
```

**Structure Decision**: Web application (Option 2). Changes are purely within existing `backend/` and `frontend/` trees — no new directories.

---

## Phase 0: Research

*All NEEDS CLARIFICATION items from Technical Context resolved below.*

See [research.md](./research.md) for full findings.

---

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md) and [contracts/](./contracts/) for full designs.

### API Method Mapping (resolved)

| mockApi call | Real api.ts method | Backend route | Status |
|---|---|---|---|
| `mockApi.getDashboardStats()` | `api.getDashboardStats()` | `GET /dashboard/stats` | ✅ exists |
| `mockApi.getRecentPayments(n)` | `api.getRecentPayments(n)` | `GET /payments/recent?limit=n` | ✅ exists |
| `mockApi.getPendingLeaveRequests()` | `api.getPendingLeaveRequests()` | `GET /leave-requests/pending` | ✅ exists |
| `mockApi.getClasses()` | `api.getClasses()` | `GET /classes` | ✅ exists |
| `mockApi.getStudentsByClassId(id)` | `api.getStudentsByClass(id)` | `GET /students/by-class/:id` | ✅ exists |
| `mockApi.getClassAttendanceSummary()` | computed client-side from `api.getStudentAttendance()` | `GET /student-attendance` | ✅ already done in code |
| `mockApi.getAttendanceByClassAndDate(cls, date)` | `api.getStudentAttendance({classId, date})` | `GET /student-attendance?classId=&date=` | ✅ exists |
| `mockApi.getStudentAttendance({classId, recordedBy?})` | `api.getStudentAttendance({classId, recordedBy?})` | `GET /student-attendance` | ✅ exists |
| `mockApi.saveAttendanceRecords(records, userId)` | `api.saveStudentAttendance(records)` | `POST /student-attendance` | ✅ exists (drop userId param) |
| `mockApi.getStaff()` | `api.getStaff()` | `GET /staff` | ✅ exists |
| `mockApi.updateStaffAttendance(id, data)` | `api.updateStaffAttendance(id, data)` | `PUT /staff-attendance/:id` | ✅ exists |
| `mockApi.recordStaffAttendance(data)` | `api.recordStaffAttendance(data)` | `POST /staff-attendance` | ⚠️ backend exists, add to api.ts |
| `mockApi.getCalendar()` | `api.getCalendar()` | `GET /calendar` | ✅ exists |
| `mockApi.updateLeaveRequest(id, data)` | `api.updateLeaveRequest(id, data)` | `PUT /leave-requests/:id` | ✅ exists |
| `mockApi.reviewLeaveRequest(id, status, by, notes)` | `api.reviewLeaveRequest(id, status, by, notes)` | `PUT /leave-requests/:id/review` | ✅ exists |
| `mockApi.deleteClass(id)` | `api.archiveClass(id)` | `DELETE /classes/:id` | ✅ exists |
| `mockApi.updateStaff(id, data)` | `api.updateStaff(id, data)` | `PUT /staff/:id` | ✅ exists |
| `mockApi.createStaff(data)` | `api.createStaff(data)` | `POST /staff` | ✅ exists |
| `mockApi.deleteRoute(id)` | `api.deleteRoute(id)` | `DELETE /transport/routes/:id` | ✅ exists |
| `mockApi.getRoutes()` | `api.getRoutes()` | `GET /transport/routes` | ✅ exists |
| `mockApi.getStudentsWithRouteStatus(routeId, term)` | `api.getStudentsWithRouteStatus(routeId, term)` | `GET /transport/routes/:id/students-with-status` | ❌ add to backend + api.ts |
| `mockApi.getTransportAssignmentsWithDetails(routeId, month?)` | `api.getTransportAssignmentsWithDetails(routeId, month?)` | `GET /transport/routes/:id/assignments` | ❌ add to backend + api.ts |
| `mockApi.recordTransportPayment(data)` | `api.recordTransportPayment(data)` | `POST /transport/payment` | ❌ add to backend + api.ts |
| `api.assignStudentsWithCharges(data)` | `api.assignStudentsWithCharges(data)` | `POST /transport/routes/:id/assign-with-charges` | ❌ add to backend + api.ts |
| `api.previewTransportCharges(data)` | `api.previewTransportCharges(data)` | `POST /transport/routes/:id/preview-charges` | ❌ add to backend + api.ts |

### New Backend Endpoints (detailed)

**1. `GET /transport/routes/:routeId/students-with-status?term=X`**  
Returns all students in the tenant with their route assignment status relative to the given route.  
Response shape per student: `{ id, firstName, lastName, className, routeStatus: 'available'|'assigned_this_route'|'assigned_other_route', assignedRouteName: string|null }`

**2. `GET /transport/routes/:routeId/assignments?month=YYYY-MM`**  
Returns all students assigned to the route (all time if month omitted) with payment/access status details.  
Response shape per record: `{ id, studentId, studentName, studentClass, access, assignedDate, startDate, endDate, routeFee, routeName, driverName, month, routeId, transportStatus }`

**3. `POST /transport/payment`**  
Records a transport fee payment for a student for a specific month. Creates a record in the `payments` table.  
Body: `{ studentId, routeId, month, amount, method, notes? }`

**4. `POST /transport/routes/:routeId/assign-with-charges`**  
Assigns students to a route AND generates transport charges for the specified date range.  
Body: `{ studentIds: string[], startDate, endDate }`  
Response: `{ createdAssignments, createdCharges, totalAmount }`

**5. `POST /transport/routes/:routeId/preview-charges`**  
Previews what charges would be generated without creating them.  
Body: `{ routeId, startDate, endDate }`  
Response: `{ routeFee, durationMonths, totalAmount, startDate, endDate, charges: [{month, amount, isProrated}] }`

### Signature Adaptations (detailed)

**`Attendance.tsx` — `saveAttendanceRecords`**  
Old call: `mockApi.saveAttendanceRecords(records, user!.id)`  
New call: `api.saveStudentAttendance(records)` — drop the `userId` param (backend derives it from JWT)

**`Attendance.tsx` — `getStudentsByClassId`**  
Old: `mockApi.getStudentsByClassId(selectedClassId)`  
New: `api.getStudentsByClass(selectedClassId)`

**`Attendance.tsx` — `getAttendanceByClassAndDate`**  
Old: `mockApi.getAttendanceByClassAndDate(classId, dateString)`  
New: `api.getStudentAttendance({ classId, date: dateString })`

**`Dashboard.tsx` teacher section — `getStudentsByClassId`**  
Old: `mockApi.getStudentsByClassId(selectedClassId)`  
New: `api.getStudentsByClass(selectedClassId)`

**`Dashboard.tsx` teacher section — `getClassAttendanceSummary`**  
Old: `mockApi.getClassAttendanceSummary(classId, startDate, endDate)` returning computed summaries  
New: Use `api.getStudentAttendance({ classId })` and compute the summary client-side (same pattern already in `Attendance.tsx::fetchAttendanceSummary`)
