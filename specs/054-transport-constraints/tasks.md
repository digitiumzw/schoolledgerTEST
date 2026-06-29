# Tasks: Transport Student Assignment Constraints & History

**Feature**: 054-transport-constraints  
**Branch**: `054-transport-constraints`  
**Total Tasks**: 52  
**Generated**: 2026-04-30

## Overview

This feature implements five user stories across backend (PHP/CodeIgniter 4) and frontend (React/TypeScript):
- **US1 (P1)**: Single Route Assignment Enforcement - Core constraint preventing duplicate active assignments
- **US2 (P1)**: Mandatory Stop Assignment - Requires valid stop_id for all assignments
- **US3 (P2)**: Automatic Student Deallocation - Auto-terminates transport on status change
- **US4 (P2)**: Transport Assignment History - Student profile history display
- **US5 (P2)**: Missing Transport Charge Alerts - Dashboard billing alerts

**MVP Scope**: US1 + US2 (14 tasks) - Core constraints enable safe transport management

---

## Phase 1: Setup

**Goal**: Database schema changes to support constraints

**Independent Test**: Run migration and verify unique constraint prevents duplicate active assignments at database level

- [ ] T001 Create migration file `backend/app/Database/Migrations/2026-04-30-120000_AddTransportConstraints.php` with is_active generated column and unique index
- [ ] T002 Run migration with `php spark migrate` and verify indexes created
- [ ] T003 Verify unique constraint prevents duplicate (tenant_id, student_id, is_active) at database level via direct SQL test

---

## Phase 2: Foundational Services

**Goal**: Core services and models that all user stories depend on

**Independent Test**: Services can be instantiated and perform basic CRUD operations

- [ ] T004 [P] Create `backend/app/Models/TransportStudentAllocationModel.php` with validation rules and custom methods
- [ ] T005 [P] Add `afterUpdate` hook to `backend/app/Models/StudentModel.php` for status change detection
- [ ] T006 Create `backend/app/Services/TransportAssignmentService.php` with validateAssignment(), checkExistingAssignment(), createAssignment() methods
- [ ] T007 Create `backend/app/Services/StudentStatusService.php` with updateStatus() method that handles transport deallocation
- [ ] T008 Add service method `TransportAssignmentService::reassignStudent()` with database transaction wrapper
- [ ] T009 Create `backend/app/Config/Routes.php` entries for new endpoints (reassign, missing-charges, transport-history)

---

## Phase 3: User Story 1 - Single Route Assignment Enforcement (P1)

**Goal**: Prevent students from having multiple active route assignments; provide reassignment capability

**Independent Test**: 
- POST /routes/:routeId/allocations with already-assigned student returns 409 with existing route info
- POST /allocations/reassign atomically ends old assignment and creates new one
- Database constraint prevents race condition concurrent assignments

### Backend Implementation

- [ ] T010 [US1] Modify `backend/app/Controllers/Api/TransportController::createAllocation()` to check existing assignment and return 409 Conflict with route details
- [ ] T011 [US1] Implement `TransportController::reassign()` endpoint calling TransportAssignmentService::reassignStudent()
- [ ] T012 [US1] Add validation rules in controller for reassignment request (studentId, fromRouteId, toRouteId, toStopId, reassignDate)
- [ ] T013 [US1] Handle database unique constraint violation (1062 error) in createAllocation() and return proper 409 response

### Frontend Implementation

- [ ] T014 [US1] [P] Create `frontend/src/hooks/useTransportAssignments.ts` with assignStudent(), reassignStudent() mutations
- [ ] T015 [US1] Create `frontend/src/components/transport/StudentAssignmentModal.tsx` with stop selection and error handling for 409 conflicts
- [ ] T016 [US1] Create `frontend/src/components/transport/ReassignStudentModal.tsx` with route selection, date picker, and confirmation flow

### Integration Tests

- [ ] T017 [US1] [P] Create `backend/tests/integration/TransportAssignmentTest.php` with testCreateAllocation_Success, testCreateAllocation_Conflict, testCreateAllocation_RaceCondition
- [ ] T018 [US1] [P] Add tests to `backend/tests/integration/TransportReassignmentTest.php`: testReassign_Success, testReassign_InvalidDate, testReassign_WrongFromRoute

---

## Phase 4: User Story 2 - Mandatory Stop Assignment (P1)

**Goal**: Require valid stop_id from the route for all assignments

**Independent Test**:
- Assignment without stop_id returns 400 Bad Request
- Assignment with stop from different route returns 400
- Route with no stops configured returns 400

### Backend Implementation

- [ ] T019 [US2] Add stopExistsOnRoute() method to `TransportAssignmentService.php`
- [ ] T020 [US2] Modify `TransportController::createAllocation()` to validate stop_id exists and belongs to route
- [ ] T021 [US2] Add check in createAllocation() for route having at least one configured stop
- [ ] T022 [US2] Update validation error messages to include specific stop validation failures

### Frontend Implementation

- [ ] T023 [US2] Modify `StudentAssignmentModal.tsx` to require stop selection (disable submit until stop selected)
- [ ] T024 [US2] Add route stops fetch to assignment modal (populate dropdown from /transport/routes/:id/stops)
- [ ] T025 [US2] Add validation error display for stop-related errors (400 responses)

### Integration Tests

- [ ] T026 [US2] Add tests to `TransportAssignmentTest.php`: testCreateAllocation_MissingStop, testCreateAllocation_InvalidStop, testCreateAllocation_RouteNoStops

---

## Phase 5: User Story 3 - Automatic Student Deallocation (P2)

**Goal**: Auto-terminate transport assignments when student status changes from active

**Independent Test**:
- Change student status to withdrawn → active transport assignment becomes inactive with end_date
- Change student status between non-active states → no transport changes
- Reactivate student → no automatic transport reactivation

### Backend Implementation

- [ ] T027 [US3] Implement `StudentModel::handleStatusChange()` afterUpdate hook to detect active→non-active transitions
- [ ] T028 [US3] Add `StudentStatusService::deactivateTransportAssignments()` method with tenant isolation
- [ ] T029 [US3] Ensure deallocation happens within same transaction as status update in StudentStatusService
- [ ] T030 [US3] Add logging for automatic deallocation events (debug level)

### Integration Tests

- [ ] T031 [US3] [P] Create `backend/tests/integration/StudentStatusTransportTest.php` with testStatusChange_ToWithdrawn_DeactivatesTransport, testStatusChange_ToSuspended_DeactivatesTransport, testStatusChange_BetweenNonActive_NoChange, testReactivation_NoAutoReassignment

---

## Phase 6: User Story 4 - Transport Assignment History (P2)

**Goal**: Display complete transport history on student profile

**Independent Test**:
- GET /students/:id/transport-history returns chronological list with route/stop details
- Student profile page shows history section with all past assignments

### Backend Implementation

- [ ] T032 [US4] Add `StudentController::getTransportHistory()` endpoint with student validation and tenant isolation
- [ ] T033 [US4] Create query in controller joining transport_student_allocations, transport_routes, transport_stops for full history
- [ ] T034 [US4] Add summary statistics to response (totalAssignments, activeAssignments, currentRoute, earliestAssignment)

### Frontend Implementation

- [ ] T035 [US4] [P] Create `frontend/src/hooks/useTransportHistory.ts` with useQuery for transport history fetch
- [ ] T036 [US4] Create `frontend/src/components/students/TransportHistorySection.tsx` displaying chronological list with status badges
- [ ] T037 [US4] Modify `frontend/src/pages/StudentProfile.tsx` to include Transport History tab/section
- [ ] T038 [US4] Add empty state for students with no transport history

### Integration Tests

- [ ] T039 [US4] [P] Create `backend/tests/integration/StudentTransportHistoryTest.php` with testGetTransportHistory_Success, testGetTransportHistory_Empty, testGetTransportHistory_TenantIsolation

---

## Phase 7: User Story 5 - Missing Transport Charge Alerts (P2)

**Goal**: Alert admins to students with active transport but no current month charge

**Independent Test**:
- Dashboard shows count of students missing charges
- Route detail page highlights students with missing charge badges
- GET /transport/missing-charges returns filtered list

### Backend Implementation

- [ ] T040 [US5] Add `TransportController::getMissingCharges()` endpoint with month/route/academicYear filters
- [ ] T041 [US5] Implement query joining transport_student_allocations with charges (LEFT JOIN) to find gaps
- [ ] T042 [US5] Add grouping by route in response with counts and student details

### Frontend Implementation

- [ ] T043 [US5] [P] Create `frontend/src/hooks/useMissingChargeAlerts.ts` with useQuery for missing charges
- [ ] T044 [US5] Create `frontend/src/components/transport/MissingChargeAlert.tsx` dashboard banner showing count and link
- [ ] T045 [US5] Modify `frontend/src/pages/TransportRoutes.tsx` to add "Missing Charge" badges on student rows
- [ ] T046 [US5] Add filter controls for missing charges by route and academic year

### Integration Tests

- [ ] T047 [US5] [P] Create `backend/tests/integration/TransportMissingChargesTest.php` with testGetMissingCharges_Success, testGetMissingCharges_ByRoute, testGetMissingCharges_AfterChargeGenerated

---

## Phase 8: Polish & Integration

**Goal**: Cross-cutting concerns, frontend API integration, and end-to-end validation

### Frontend API Integration

- [ ] T048 Modify `frontend/src/api/api.ts` to add transportHistory(), missingCharges(), reassignStudent() methods
- [ ] T049 Add error handling and toast notifications for all transport operations

### End-to-End Validation

- [ ] T050 Run complete integration test suite: `cd backend && ./vendor/bin/phpunit tests/integration/Transport*`
- [ ] T051 Manual testing checklist: assign student, attempt duplicate (should fail), reassign, change status to withdrawn, view history, verify missing charge alert
- [ ] T052 Verify all constitution principles in final code review (tenant isolation, JWT auth, REST standards, etc.)

---

## Dependencies

### Story Completion Order

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) - All stories depend on T004-T009
    ↓
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│   US1 (P1)      │   US2 (P1)      │   US3 (P2)      │   US4 (P2)      │   US5 (P2)
│   Can start     │   Can start     │   Can start     │   Can start     │   Can start
│   after T009    │   after T009    │   after T009    │   after T009    │   after T009
│   Blocks:       │   Blocks:       │   Independent   │   Independent   │   Independent
│   US2 T019-T021 │   Nothing       │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
    ↓
Phase 8 (Polish) - Depends on all stories
```

### Task Dependencies

| Task | Depends On | Parallel With |
|------|------------|---------------|
| T010 | T006, T009 | T019, T027, T032, T040 |
| T014 | T010 | T015, T016 |
| T017 | T010, T011 | T018 |
| T020 | T019 | T022 |
| T023 | T014 | T024, T025 |
| T028 | T005, T007 | T029 |
| T035 | T032 | T036, T037 |
| T043 | T040 | T044, T045 |

---

## Parallel Execution Examples

### Sprint 1: MVP (US1 + US2) - Days 1-5

**Day 1-2 (Backend)**:
- Developer A: T001, T002, T003 (Setup) → T004, T006 (Model + Service) → T010, T011 (US1 Controller)
- Developer B: T005 (StudentModel hook) → T007, T008 (Services) → T019, T020, T021 (US2 validation)

**Day 3-4 (Frontend)**:
- Developer C: T014 (hooks) → T015, T016 (modals)
- Developer D: T023, T024, T025 (stop validation UI)

**Day 5 (Testing)**:
- Both: T017, T018, T026 (Integration tests)
- QA: Manual testing of assignment flow

### Sprint 2: P2 Stories - Days 6-10

**Parallel tracks**:
- Track 1 (US3 Auto-deallocation): T027, T028, T029, T031
- Track 2 (US4 History): T032, T033, T034, T035, T036, T037, T039
- Track 3 (US5 Alerts): T040, T041, T042, T043, T044, T045, T047

**Day 10**: T048-T052 (Polish & Integration)

---

## Implementation Strategy

### MVP First (Recommended)

Implement US1 + US2 first (14 tasks) to deliver core safety constraints:
1. Prevents billing errors (duplicate assignments)
2. Ensures route data integrity (mandatory stops)
3. Enables safe transport operations

This MVP can be deployed independently while P2 stories are developed.

### Incremental Delivery

| Phase | Stories | Deployable | Value |
|-------|---------|------------|-------|
| 1 | US1 + US2 | Yes - Core constraints | Prevents billing errors |
| 2 | US3 | Yes - Auto-cleanup | Reduces admin overhead |
| 3 | US4 | Yes - Audit capability | Enables dispute resolution |
| 4 | US5 | Yes - Billing alerts | Prevents revenue loss |

### Risk Mitigation

- **Database constraint (T001-T003)**: Test rollback before applying to production
- **Race conditions (T011)**: Load test concurrent reassignment attempts
- **Status change hook (T027)**: Verify hook fires on all status update paths (Model methods only, not raw queries)

---

## Task Summary by Story

| Story | Priority | Tasks | Key Deliverables |
|-------|----------|-------|------------------|
| US1 | P1 | 9 | Single route constraint, reassignment API, conflict handling |
| US2 | P1 | 5 | Stop validation, route stops requirement |
| US3 | P2 | 5 | Auto-deallocation on status change |
| US4 | P2 | 8 | Transport history endpoint, student profile UI |
| US5 | P2 | 8 | Missing charges API, dashboard alerts |
| Setup | - | 3 | Migration, schema constraints |
| Foundation | - | 6 | Models, services, routes |
| Polish | - | 5 | API integration, E2E tests |
| **Total** | - | **52** | - |

---

## Test Coverage Requirements

Per Constitution Principle X (Integration Testing), each story requires:
- Happy path test (success case)
- Error/edge-case test (validation failure, conflict, etc.)
- Tenant isolation test (cross-tenant access returns 404)

All integration tests are marked with [P] for parallel execution during test runs.
