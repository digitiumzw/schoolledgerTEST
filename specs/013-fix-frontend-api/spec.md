# Feature Specification: Fix Frontend Bugs and Replace MockApi

**Feature Branch**: `013-fix-frontend-api`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "fix the bugs in the frontend, and i want the system to use api instead of mockApi and other issues"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dashboard Loads Real Data (Priority: P1)

As an admin or teacher, when I navigate to the Dashboard, I see live data fetched from the backend instead of an error or blank screen caused by the missing `mockApi` module.

**Why this priority**: The Dashboard is the first screen users see after login. If it crashes due to a broken import, the application is completely unusable for that role.

**Independent Test**: Can be fully tested by logging in as admin or teacher and confirming the Dashboard displays real counts (students, payments, pending leaves, attendance summaries) without console errors.

**Acceptance Scenarios**:

1. **Given** a logged-in admin, **When** the Dashboard page loads, **Then** it displays real-time school stats (student count, total fees collected, attendance rate) fetched from the backend API without any runtime errors.
2. **Given** a logged-in teacher, **When** the Dashboard page loads, **Then** it displays the teacher's classes and student attendance summaries fetched from the backend API.
3. **Given** the backend is reachable, **When** the Dashboard data loads, **Then** recent payments and pending leave requests appear in the activity feed.

---

### User Story 2 - Student Attendance Page Works End-to-End (Priority: P1)

As a teacher or admin, I can view and save student attendance records using the real backend API, without the page crashing due to the missing `mockApi` import.

**Why this priority**: Attendance recording is a core daily operation. A broken import makes the entire Attendance page non-functional.

**Independent Test**: Can be fully tested by navigating to the Attendance page, selecting a class and date, viewing students, marking their statuses, and saving — confirming data persists in the backend.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the Attendance page, **When** a class is selected, **Then** the student list loads from the backend API.
2. **Given** a class and date selected, **When** the page loads, **Then** any existing attendance records for that date are fetched and pre-filled.
3. **Given** attendance statuses marked for all students, **When** the user saves, **Then** records are persisted via the backend API and a success message is shown.

---

### User Story 3 - All Modal Actions Use Real API (Priority: P2)

As a school administrator, when I use modals to manage staff, leave requests, transport routes, and class deletions, all actions are sent to the real backend — not a mock that only existed in memory.

**Why this priority**: Modals for creating/editing staff, reviewing leave, managing transport assignments, and deleting classes all imported from the missing `mockApi`. Any action taken appeared to succeed locally but was never persisted.

**Independent Test**: Can be tested by opening each affected modal, performing its primary action (e.g., create staff, review leave, delete route), and confirming the backend database reflects the change.

**Acceptance Scenarios**:

1. **Given** the Staff Form modal open, **When** a new staff member is created or an existing one is updated, **Then** the change is persisted via the backend staff API.
2. **Given** the Review Leave modal open, **When** a leave request is approved or rejected, **Then** the status change is sent to the backend and reflected in the leave list.
3. **Given** the Manual Attendance modal open for staff, **When** an attendance record is created or updated, **Then** it is saved via the backend staff attendance API.
4. **Given** the Assign Students to Route modal open, **When** a route is selected, **Then** students with their route enrollment status are fetched from the backend.
5. **Given** the Transport Assignment Status modal open, **When** a transport payment is recorded, **Then** the payment data is sent to the backend transport API.
6. **Given** the Delete Class modal open, **When** deletion is confirmed, **Then** the class is removed via the backend class archive or permanent delete endpoint.
7. **Given** the Delete Route modal open, **When** deletion is confirmed, **Then** the route is removed via the backend transport route API.

---

### Edge Cases

- What happens when the backend returns a 401 (session expired) during a modal action? The session expiry handler should trigger and redirect to login.
- What happens when a `getStudentsWithRouteStatus` or `getTransportAssignmentsWithDetails` equivalent does not exist in the real API? These must be mapped to the nearest available real endpoint or the backend must expose the required endpoint.
- What happens when `getClassAttendanceSummary` is not available in the real API? The teacher dashboard summary should gracefully degrade or the endpoint must be added to the backend.
- How does the system handle mismatched payload shapes between the old mockApi calls and the real API endpoints?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All `import { mockApi } from "@/api/mockApi"` statements MUST be replaced with imports from `@/api/api` using the real `api` object.
- **FR-002**: The `Dashboard.tsx` page MUST call `api.getDashboardStats()`, `api.getRecentPayments()`, and `api.getPendingLeaveRequests()` instead of the mockApi equivalents.
- **FR-003**: The teacher section of `Dashboard.tsx` MUST call `api.getClasses()` and `api.getStudentsByClass(classId)` instead of `mockApi.getStudentsByClassId`.
- **FR-004**: `Attendance.tsx` MUST call `api.getClasses()`, `api.getStudentsByClass()`, `api.getStudentAttendance()`, and `api.saveStudentAttendance()` with the correct payload shape.
- **FR-005**: `ManualAttendanceModal.tsx` MUST call `api.getStaff()`, `api.updateStaffAttendance()`, and the appropriate staff check-in endpoint mapped from `recordStaffAttendance`.
- **FR-006**: `StaffFormModal.tsx` MUST call `api.createStaff()` and `api.updateStaff()`.
- **FR-007**: `ReviewLeaveModal.tsx` MUST call `api.getStaff()` and `api.reviewLeaveRequest()`.
- **FR-008**: `EditLeaveRequestModal.tsx` MUST call `api.getCalendar()` and `api.updateLeaveRequest()`.
- **FR-009**: `DeleteClassModal.tsx` MUST call `api.archiveClass()` or `api.deleteClassPermanently()` instead of the mockApi `deleteClass`.
- **FR-010**: `DeleteRouteModal.tsx` MUST call `api.deleteRoute()`.
- **FR-011**: `AssignStudentsToRouteModal.tsx` MUST fetch students with route status from the real backend transport endpoints.
- **FR-012**: `TransportAssignmentStatusModal.tsx` and `TransportReportModal.tsx` MUST use real transport API endpoints for fetching assignment details and recording payments.
- **FR-013**: All replaced API calls MUST handle errors gracefully — network errors and 4xx/5xx responses must show a user-friendly error message rather than crashing the component.
- **FR-014**: The teacher dashboard MUST call a real attendance summary endpoint; if `getClassAttendanceSummary` does not exist in the backend, the frontend degrades gracefully showing an informative empty state.
- **FR-015**: Any transport-specific methods missing from the real API (`getTransportAssignmentsWithDetails`, `getStudentsWithRouteStatus`, `recordTransportPayment`) MUST either be added to `api.ts` pointing to real backend endpoints, or the backend must expose those endpoints.

### Key Entities

- **mockApi**: A now-absent module that 11+ files still import from; all usages must be migrated to the real `api`.
- **api**: The real production API client (`src/api/api.ts`) that communicates with the CodeIgniter 4 backend via JWT-authenticated HTTP requests.
- **AttendanceRecord**: Payload shape for saving student attendance; must match what the real `saveStudentAttendance` endpoint expects.
- **StaffAttendanceRecord**: Payload for recording staff check-in/check-out; `recordStaffAttendance` must map to `checkInStaff` or a dedicated backend endpoint.
- **TransportAssignment**: Data structure for student–route assignments with payment status detail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero runtime import errors related to `mockApi` across all pages and modals after the fix.
- **SC-002**: All 11 affected files compile without TypeScript errors and load without runtime crashes.
- **SC-003**: Dashboard, Attendance, Staff, Leave, Transport, and Class management features all display and persist live data from the backend.
- **SC-004**: No regression in existing features that already correctly use `api` — those pages must continue working after the migration.
- **SC-005**: Any action performed through an affected modal (create, update, delete, review) is durably persisted in the backend database and visible after a page refresh.

## Assumptions

- The real `api` object in `src/api/api.ts` already implements most required endpoints — only transport-specific methods and attendance summary may need additions.
- `mockApi.getStudentsByClassId` maps to `api.getStudentsByClass` (`/students/by-class/:classId`).
- `mockApi.saveAttendanceRecords` maps to `api.saveStudentAttendance` — payload shape is assumed to be compatible or will be adapted during implementation.
- `mockApi.recordStaffAttendance` will be mapped to `api.checkInStaff` / `api.checkOutStaff` based on the record type.
- `mockApi.getTransportAssignmentsWithDetails` and `mockApi.getStudentsWithRouteStatus` will either map to existing transport endpoints or require new backend endpoints to be created.
- `mockApi.getClassAttendanceSummary` may require a new backend endpoint; if absent, the teacher dashboard will display a graceful empty state.
- Mobile/responsive layout of affected pages is out of scope — only API wiring and error-handling bug fixes are in scope.
