# Implementation Tasks: Dashboard School Overview

**Branch**: `021-dashboard-school-overview` | **Date**: 2026-04-08  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup Tasks

### Story Goal
Prepare the development environment and create the necessary structure for dashboard components.

### Independent Test Criteria
- Dashboard component folder structure exists
- All necessary dependencies are installed
- Basic dashboard page renders without errors

### Implementation Tasks

- [X] T001 Create dashboard components directory structure in frontend/src/components/dashboard/
- [X] T002 Install any missing shadcn/ui components (Card, Alert, Skeleton if not already present)
- [X] T003 Create base dashboard types file in frontend/src/types/dashboard.ts
- [X] T004 Create useDashboardStats hook skeleton in frontend/src/hooks/useDashboardStats.ts

## Phase 2: Foundational Tasks (Backend)

### Story Goal
Extend the backend API to provide all required dashboard metrics.

### Independent Test Criteria
- GET /api/dashboard/stats returns all required fields including new alert metrics
- GET /api/dashboard/activity returns recent activity feed
- Role-based filtering works correctly

### Implementation Tasks

- [X] T005 Extend DashboardController::stats() with pendingLeaveRequests aggregation in backend/app/Controllers/Api/DashboardController.php
- [X] T006 Extend DashboardController::stats() with lowAttendanceStudents aggregation in backend/app/Controllers/Api/DashboardController.php
- [X] T007 Create DashboardController::activity() method for recent activity feed in backend/app/Controllers/Api/DashboardController.php
- [X] T008 Add role enforcement to DashboardController methods (teachers get 403 on stats) in backend/app/Controllers/Api/DashboardController.php
- [X] T009 Update DashboardStats type definition in frontend/src/types/dashboard.ts to include new fields
- [X] T010 Add getDashboardActivity method to API client in frontend/src/api/api.ts

## Phase 3: User Story 1 - Admin Gets Full School Health Snapshot (P1)

### Story Goal
Display all key metric sections on a single screen for admin users.

### Independent Test Criteria
- Admin sees all metric tiles (enrolment, outstanding, collection rate, staff, classes, transport)
- Metrics update in real-time without page refresh
- Zero values display with appropriate messaging

### Implementation Tasks

- [X] T011 [US1] Create MetricTile component in frontend/src/components/dashboard/MetricTile.tsx
- [X] T012 [US1] Create DashboardSection wrapper component in frontend/src/components/dashboard/DashboardSection.tsx
- [X] T013 [P] [US1] Create TransportSection component in frontend/src/components/dashboard/TransportSection.tsx
- [X] T014 [P] [US1] Implement useDashboardStats hook with TanStack Query in frontend/src/hooks/useDashboardStats.ts
- [X] T015 [US1] Update Dashboard.tsx main component to render all sections in responsive grid layout in frontend/src/pages/Dashboard.tsx

## Phase 4: User Story 2 - Financial Overview Section (P1)

### Story Goal
Display detailed financial metrics including term revenue, outstanding debt, and collection rate.

### Independent Test Criteria
- Financial section shows all required metrics
- Values match Payments page totals
- Collection rate shows 0% when no charges exist

### Implementation Tasks

- [X] T016 [US2] Create FinancialSection component in frontend/src/components/dashboard/FinancialSection.tsx
- [X] T017 [US2] Add currency formatting utility for large amounts in frontend/src/lib/studentUtils.ts
- [X] T018 [US2] Implement zero-state handling for financial metrics in FinancialSection component
- [X] T019 [US2] Add refresh mechanism after payment recordings in FinancialSection component

## Phase 5: User Story 3 - Enrolment & Academics Overview Section (P2)

### Story Goal
Show student enrolment numbers, class counts, average class size, and bursary information.

### Independent Test Criteria
- Enrolment section displays all metrics accurately
- Values match Students and Classes page totals
- Empty states show actionable links

### Implementation Tasks

- [X] T020 [US3] Create EnrolmentSection component in frontend/src/components/dashboard/EnrolmentSection.tsx
- [X] T021 [US3] Add navigation links to Classes page for empty states in EnrolmentSection component
- [X] T022 [US3] Implement average class size calculation display in EnrolmentSection component

## Phase 6: User Story 4 - Staff & Alerts Section (P2)

### Story Goal
Display staff summary and alerts for pending leave requests and low student attendance.

### Independent Test Criteria
- Staff section shows total staff and pending leave count
- Low attendance alert shows count with link to Attendance page
- Zero states display appropriate messages

### Implementation Tasks

- [X] T023 [US4] Create StaffSection component in frontend/src/components/dashboard/StaffSection.tsx
- [X] T024 [US4] Add navigation links to staff-attendance page for leave requests in StaffSection component
- [X] T025 [US4] Add navigation link to Attendance page for low attendance alerts in StaffSection component
- [X] T026 [US4] Implement real-time updates for staff metrics in StaffSection component

## Phase 7: User Story 5 - Recent Activity Feed (P2)

### Story Goal
Display chronological feed of recent payments and leave requests.

### Independent Test Criteria
- Feed shows 10 most recent events in reverse-chronological order
- Events are visually distinguished by type with icons
- Empty state shows "No recent activity" message

### Implementation Tasks

- [X] T027 [US5] Create ActivityFeed component in frontend/src/components/dashboard/ActivityFeed.tsx
- [X] T028 [US5] Implement relative time formatting for timestamps in frontend/src/lib/dateUtils.ts
- [X] T029 [US5] Add type-specific icons and styling for activity items in ActivityFeed component
- [X] T030 [US5] Implement empty state handling in ActivityFeed component

## Phase 8: User Story 6 - Quick Actions Bar (P3)

### Story Goal
Provide quick access buttons for common tasks (add student, record payment, mark attendance).

### Independent Test Criteria
- Quick action buttons open appropriate modals
- Financial tiles refresh after payment recording
- All actions work without leaving dashboard

### Implementation Tasks

- [X] T031 [US6] Create QuickActions component in frontend/src/components/dashboard/QuickActions.tsx
- [X] T032 [US6] Integrate existing StudentFormModal with QuickActions in Dashboard.tsx
- [X] T033 [US6] Integrate existing RecordPaymentModal with QuickActions in Dashboard.tsx
- [X] T034 [US6] Add navigation to attendance page for Mark Attendance action in QuickActions component
- [X] T035 [US6] Implement automatic tile refresh after successful quick actions in Dashboard.tsx

## Phase 9: User Story 7 - Teacher Dashboard (P3)

### Story Goal
Ensure teachers see only class-specific attendance data, no financial or staff information.

### Independent Test Criteria
- Teachers see only class selection and attendance data
- No financial, staff, transport, or alert sections visible
- Existing teacher functionality preserved

### Implementation Tasks

- [X] T036 [US7] Add role-based conditional rendering in Dashboard.tsx main component
- [X] T037 [US7] Verify TeacherDashboard component remains unchanged and functional
- [X] T038 [US7] Test role enforcement with different user roles in Dashboard.tsx

## Phase 10: Polish & Cross-Cutting Concerns

### Story Goal
Ensure performance, error handling, and responsive design across all dashboard sections.

### Independent Test Criteria
- Dashboard loads within 3 seconds
- Skeleton loaders appear within 300ms
- All sections handle errors gracefully
- Layout responsive on mobile, tablet, and desktop

### Implementation Tasks

- [X] T039 Implement skeleton loaders for all dashboard sections in respective components
- [X] T040 Add error boundaries and retry mechanisms for each section in DashboardSection component
- [X] T041 Optimize responsive grid layout for all screen sizes in Dashboard.tsx
- [X] T042 Add loading state management for slow API responses in useDashboardStats hook
- [X] T043 Implement proper NaN/undefined handling for all metric displays across components
- [X] T044 Add accessibility labels and ARIA attributes to dashboard components
- [X] T045 Test and verify all Constitution compliance (tenant isolation, API-first, etc.)

## Dependencies

### Story Completion Order
1. **Phase 1 & 2** (Setup & Backend) - Must complete first
2. **US1** (Admin Snapshot) - Foundation for all other sections
3. **US2** (Financial) - Can be done in parallel with US3-US4
4. **US3** (Enrolment) - Can be done in parallel with US2-US4
5. **US4** (Staff & Alerts) - Can be done in parallel with US2-US3
6. **US5** (Activity Feed) - Depends on backend activity endpoint
7. **US6** (Quick Actions) - Depends on US1-US4 sections
8. **US7** (Teacher Dashboard) - Can be done anytime after US1
9. **Phase 10** (Polish) - Done after all user stories

### Parallel Execution Opportunities

**Within Phase 3 (US1)**:

- T011, T013, T014 can be done in parallel (different files)
- T012 and T015 depend on T011

**Within Phases 4-6 (US2-US4)**:

- All component creation tasks (T016, T020, T023, T027) can be done in parallel
- Utility functions can be created in parallel

**Within Phase 10**:

- T039-T044 can be done in parallel across different concerns

## Implementation Strategy

### MVP Scope (First Release)

1. Complete Phase 1 & 2 (Setup & Backend)
2. Implement US1 (Admin Snapshot) - Basic tiles and layout
3. Implement US2 (Financial) - Most critical section
4. Basic error handling and responsive design

### Incremental Delivery
1. **Week 1**: Backend API extensions, basic dashboard structure
2. **Week 2**: Core admin sections (US1, US2)
3. **Week 3**: Additional sections (US3-US5)
4. **Week 4**: Quick actions, teacher view, polish

### Risk Mitigation
- Test each section independently before integration
- Preserve existing teacher dashboard functionality
- Use existing UI components and patterns
- Implement role-based filtering early to avoid security issues

## Total Task Count: 45

### Tasks by User Story

- Setup: 4 tasks
- Foundational (Backend): 6 tasks
- US1 (Admin Snapshot): 5 tasks
- US2 (Financial): 4 tasks
- US3 (Enrolment): 3 tasks
- US4 (Staff & Alerts): 4 tasks
- US5 (Activity Feed): 4 tasks
- US6 (Quick Actions): 5 tasks
- US7 (Teacher Dashboard): 3 tasks
- Polish: 7 tasks

### Parallel Opportunities
- 15 tasks can be executed in parallel with appropriate team distribution
- Critical path: T001-T002-T005-T006-T007-T011-T015 (backend + basic layout)
