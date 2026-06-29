# Tasks: Driver Kiosk View-Only Access

**Input**: Design documents from `/specs/055-driver-kiosk-viewonly/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/driver-kiosk.md, contracts/payment-status.md, quickstart.md

**Tests**: Integration tests included per Constitution Principle X.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/` (Controllers, Models, Services)
- **Frontend**: `frontend/src/` (api, pages, components)
- **Tests**: `backend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing transport schema and kiosk infrastructure is in place

- [x] T001 Verify existing transport tables exist (transport_vehicles, transport_routes, transport_stops, transport_route_periods, transport_student_allocations, transport_drivers) by running `php spark migrate` in backend/
- [x] T002 [P] Verify existing DriverKioskController.php and DriverKioskPage.tsx are functional by testing kiosk login flow at /kiosk/driver/:code
- [x] T003 [P] Verify kiosk_code and driverKioskModeEnabled are set in tenant settings for test tenant

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create new models and service layer that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create TransportVehicleModel with getActiveForTenant() and getByDriverAssignment() methods in backend/app/Models/TransportVehicleModel.php
- [x] T005 [P] Create TransportStopModel with getStopsForRoute() (ordered by order_position ASC) method in backend/app/Models/TransportStopModel.php
- [x] T006 Create DriverKioskService with resolveDriverBusAndRoutes() method (joins transport_route_periods + transport_vehicles + transport_routes, filters by driver staff_id and active status) in backend/app/Services/DriverKioskService.php
- [x] T007 Add getStudentsPaymentStatus() bulk method to DriverKioskService (queries charges where charge_type='transport' + payments, returns map of student_id => 'paid'|'unpaid') in backend/app/Services/DriverKioskService.php

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Driver Login via Employee ID (Priority: P1) 🎯 MVP

**Goal**: Driver authenticates via Employee ID and sees dashboard with assigned bus info

**Independent Test**: Login with valid Employee ID → see driver name, bus details, and route list. Login with invalid ID → see "Employee ID not recognized" error. Idle timeout → auto-logout.

**Note**: US1 login logic already exists in DriverKioskController::validateDriver(). This phase ENHANCES the validate endpoint to return bus information (which bridges into US2 scope per spec acceptance scenario 1: "redirected to their dashboard showing assigned bus information").

### Implementation for User Story 1

- [x] T008 [US1] Extend DriverKioskController::validateDriver() to use DriverKioskService::resolveDriverBusAndRoutes() and return bus object {id, name, regNumber, type, capacity} plus routes with embedded stops in response data in backend/app/Controllers/Api/DriverKioskController.php
- [x] T009 [US1] Add KioskBus, KioskStop, KioskRoute TypeScript interfaces to frontend/src/api/api.ts (replacing/extending existing DriverKioskRoute and DriverKioskValidateResponse)
- [x] T010 [US1] Update kioskDriverApi.validate() return type to DriverKioskValidateResponse (with bus + routes with stops) in frontend/src/api/api.ts
- [x] T011 [US1] Update DriverKioskPage routes view to display bus info card (BusInfoCard component) above route list in frontend/src/pages/DriverKioskPage.tsx
- [x] T012 [P] [US1] Create BusInfoCard component displaying bus name, reg number, type, and capacity in frontend/src/components/driver-kiosk/BusInfoCard.tsx
- [x] T013 [US1] Handle "no bus assigned" state — show informational message when validateDriver returns no bus/routes in frontend/src/pages/DriverKioskPage.tsx
- [x] T014 [US1] Verify idle timeout (2-minute auto-logout) works correctly with enhanced data in frontend/src/pages/DriverKioskPage.tsx

**Checkpoint**: Driver can log in, see bus info, see route list with stops, and auto-logout works

---

## Phase 4: User Story 2 - View Assigned Bus and Routes (Priority: P1)

**Goal**: Driver sees their assigned bus details, all routes, and stops in correct sequence order

**Independent Test**: After login, driver sees bus card with vehicle details. Clicking a route shows all stops in sequence with names and pickup times.

### Implementation for User Story 2

- [x] T015 [US2] Extend DriverKioskService::resolveDriverBusAndRoutes() to include stops per route by calling TransportStopModel::getStopsForRoute() and embedding stops array {id, name, pickupTime, orderPosition} in each route object in backend/app/Services/DriverKioskService.php
- [x] T016 [US2] Update DriverKioskValidateResponse interface to include stops array in each KioskRoute in frontend/src/api/api.ts
- [x] T017 [P] [US2] Create RouteStopsList component displaying stops in sequence order with stop name, pickup time, and order indicator in frontend/src/components/driver-kiosk/RouteStopsList.tsx
- [x] T018 [US2] Add route detail/expand view to DriverKioskPage — when driver taps a route, show RouteStopsList with all stops in sequence in frontend/src/pages/DriverKioskPage.tsx
- [x] T019 [US2] Handle empty stops case — show "No stops configured" message when route has no stops in frontend/src/components/driver-kiosk/RouteStopsList.tsx

**Checkpoint**: Driver can view bus details, expand routes to see stops in sequence with pickup times

---

## Phase 5: User Story 3 - View Active Students on Routes (Priority: P1)

**Goal**: Driver sees all active students per route with their assigned stop, direction, and special instructions

**Independent Test**: Select a route → see student roster with each student's name, stop name, pickup time, direction, and notes. Inactive students are excluded.

### Implementation for User Story 3

- [x] T020 [US3] Extend DriverKioskController::roster() to join transport_stops for stop name and pickup_time, include direction and notes from transport_student_allocations in student objects in backend/app/Controllers/Api/DriverKioskController.php
- [x] T021 [US3] Update DriverKioskRosterResponse and DriverKioskStudent interfaces to include stop {id, name, pickupTime}, direction, and notes fields in frontend/src/api/api.ts
- [x] T022 [P] [US3] Create StudentRosterItem component displaying student name, assigned stop, direction badge, and notes in frontend/src/components/driver-kiosk/StudentRosterItem.tsx
- [x] T023 [US3] Refactor DriverKioskPage roster view to use StudentRosterItem components instead of inline student rendering in frontend/src/pages/DriverKioskPage.tsx
- [x] T024 [US3] Handle student with no stop assignment — show "Stop not assigned" indicator when stop is null in frontend/src/components/driver-kiosk/StudentRosterItem.tsx
- [x] T025 [US3] Add busName field to roster response (from transport_route_periods join) in backend/app/Controllers/Api/DriverKioskController.php

**Checkpoint**: Driver can view complete student roster with stop details, direction, and notes per route

---

## Phase 6: User Story 4 - Filter Students by Payment Status (Priority: P2)

**Goal**: Driver can toggle "Paid Only" filter to show only students who have paid transport fees

**Independent Test**: View roster → toggle "Paid Only" → only paid students shown. Toggle off → all students shown with paid/unpaid badges. Empty paid list shows "No paid students found" message.

### Implementation for User Story 4

- [x] T026 [US4] Add paid_only query parameter handling to DriverKioskController::roster() — when true, call DriverKioskService::getStudentsPaymentStatus() and filter students list to only 'paid' in backend/app/Controllers/Api/DriverKioskController.php
- [x] T027 [US4] Always include paymentStatus ('paid'|'unpaid') in each student object in roster response (even when paid_only=false), and add totalCount, paidCount, unpaidCount to response in backend/app/Controllers/Api/DriverKioskController.php
- [x] T028 [US4] Update kioskDriverApi.getRoster() to accept paid_only parameter and update DriverKioskRosterResponse interface with totalCount, paidCount, unpaidCount fields in frontend/src/api/api.ts
- [x] T029 [P] [US4] Create PaidOnlyFilter component with toggle switch and student count display (paidCount / totalCount) in frontend/src/components/driver-kiosk/PaidOnlyFilter.tsx
- [x] T030 [US4] Add paymentStatus badge (green "Paid" / red "Unpaid") to StudentRosterItem component in frontend/src/components/driver-kiosk/StudentRosterItem.tsx
- [x] T031 [US4] Integrate PaidOnlyFilter into DriverKioskPage roster view — toggle calls getRoster with paid_only param, display updates accordingly in frontend/src/pages/DriverKioskPage.tsx
- [x] T032 [US4] Handle "No paid students found" empty state when paid_only=true returns empty list in frontend/src/pages/DriverKioskPage.tsx

**Checkpoint**: Driver can filter students by payment status, see paid/unpaid badges, and get accurate counts

---

## Phase 7: Integration Tests (Constitution Principle X)

**Purpose**: End-to-end integration tests covering happy path, error cases, and tenant isolation

- [x] T033 Create DriverKioskTest integration test file with test setup (tenant, staff with employee_id, transport driver, vehicle, route, stops, student allocations, charges, payments) in backend/tests/integration/DriverKioskTest.php
- [x] T034 [P] Add test: validateDriver returns bus info and routes with stops for valid employee_id in backend/tests/integration/DriverKioskTest.php
- [x] T035 [P] Add test: validateDriver returns 403 for invalid/inactive employee_id (enumeration prevention) in backend/tests/integration/DriverKioskTest.php
- [x] T036 [P] Add test: roster returns students with stop details, direction, and notes in backend/tests/integration/DriverKioskTest.php
- [x] T037 [P] Add test: roster with paid_only=true filters to only paid students in backend/tests/integration/DriverKioskTest.php
- [x] T038 [P] Add test: roster payment status calculation — fully paid, partially paid, no charges, overpaid in backend/tests/integration/DriverKioskTest.php
- [x] T039 [P] Add test: tenant isolation — driver from tenant A cannot see tenant B routes/students in backend/tests/integration/DriverKioskTest.php
- [x] T040 [P] Add test: roster returns 403 when route not assigned to requesting driver in backend/tests/integration/DriverKioskTest.php
- [x] T041 [P] Add test: roster excludes inactive students (withdrawn/suspended) and inactive allocations in backend/tests/integration/DriverKioskTest.php

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, type-checking, and quality assurance

- [x] T042 Run PHP lint check on all modified/created PHP files in backend/
- [x] T043 [P] Run TypeScript type-check on frontend (bun run type-check) in frontend/
- [x] T044 [P] Run ESLint check on frontend (bun run lint) in frontend/
- [x] T045 Verify kiosk UI renders correctly on tablet viewport (1024x768 minimum) — no horizontal scrolling in frontend/src/pages/DriverKioskPage.tsx
- [x] T046 Run quickstart.md validation — complete test flow from login through paid-only filter using curl commands

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (needs DriverKioskService, TransportVehicleModel)
- **US2 (Phase 4)**: Depends on Phase 2 + Phase 3 (extends validate response with stops)
- **US3 (Phase 5)**: Depends on Phase 2 (extends roster endpoint, independent of US1/US2 frontend)
- **US4 (Phase 6)**: Depends on Phase 2 + Phase 5 (adds payment filter to roster)
- **Tests (Phase 7)**: Depends on all backend user stories (Phases 3-6)
- **Polish (Phase 8)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational — No dependencies on other stories
- **US2 (P1)**: Depends on US1 backend (extends same validate endpoint) — Frontend independent
- **US3 (P1)**: Depends on Foundational — Independent of US1/US2 (different endpoint)
- **US4 (P2)**: Depends on US3 backend (adds filter to roster endpoint) — Frontend extends roster view

### Within Each User Story

- Models before services
- Services before controllers
- Backend before frontend
- Core implementation before edge case handling

### Parallel Opportunities

- T004 + T005 (TransportVehicleModel + TransportStopModel) — different files
- T012 (BusInfoCard) can run parallel with T008-T010 (backend + API changes)
- T017 (RouteStopsList) can run parallel with T015-T016 (backend + API changes)
- T022 (StudentRosterItem) can run parallel with T020-T021 (backend + API changes)
- T029 (PaidOnlyFilter) can run parallel with T026-T028 (backend + API changes)
- All integration tests T034-T041 can run in parallel (same file but independent test cases)

---

## Parallel Example: User Story 1

```bash
# Backend + API work (sequential within):
Task T008: "Extend validateDriver() with bus+routes data"
Task T009: "Add TypeScript interfaces"
Task T010: "Update kioskDriverApi.validate()"

# Parallel frontend component:
Task T012: "Create BusInfoCard component"

# Then integrate:
Task T011: "Update DriverKioskPage routes view with BusInfoCard"
Task T013: "Handle no-bus-assigned state"
Task T014: "Verify idle timeout"
```

## Parallel Example: User Story 3 + 4 (Backend)

```bash
# After US3 backend is done, US4 backend can start:
Task T020: "Extend roster() with stop details"  # US3
Task T025: "Add busName to roster response"      # US3
# Then US4:
Task T026: "Add paid_only filter to roster()"    # US4
Task T027: "Add paymentStatus + counts"          # US4
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3)

1. Complete Phase 1: Setup (verify existing infrastructure)
2. Complete Phase 2: Foundational (models + service)
3. Complete Phase 3: US1 (login + bus info display)
4. Complete Phase 4: US2 (route stops display)
5. Complete Phase 5: US3 (student roster with stop info)
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Deploy/demo if ready — driver can log in, see bus, routes, stops, and student roster

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Login with bus info (MVP core!)
3. Add US2 → Route stops in sequence
4. Add US3 → Student roster with stop details
5. Add US4 → Paid-only filter (P2 value add)
6. Integration tests → Constitution compliance
7. Polish → Production ready

### Suggested MVP Scope

**MVP = US1 + US2 + US3** (Phases 1-5, tasks T001-T025)

This delivers the core value: driver logs in, sees bus, routes with stops, and student roster with stop assignments. US4 (paid filter) is P2 and can be delivered incrementally afterward.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- US1 login already exists — this plan ENHANCES it with bus info
- No database migrations required — using existing transport schema
- All backend queries MUST include tenant_id per Constitution Principle I
- Payment calculation uses bulk queries (not N+1) per Constitution Principle XI
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
