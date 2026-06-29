# Tasks: Fix Recent Activity Scope Isolation

This document outlines the execution plan for fixing the Recent Activity scope isolation bugs.

## Dependencies

- Phase 1 (Setup) must be completed first.
- Phase 2 (US1 - Platform Activity) can be done independently.
- Phase 3 (US2 - Tenant Activity) can be done independently.
- Phase 4 (US3 - Empty States) depends on Phase 2 & 3.

## Phase 1: Setup & Foundational (T001-T002)

- [x] T001 Define updated `ActivityItem` type in `frontend/src/hooks/useDashboardStats.ts` adding "enrollment" and "status_change" to the union type.
- [x] T002 Update `actionIconMap` in `frontend/src/admin/pages/Dashboard.tsx` to ensure proper fallback styling for platform events.

## Phase 2: US1 - Platform Admin Sees Only Platform Activity (T003-T004)

**Goal**: Ensure platform dashboard only shows `platform.*` prefixed audit events.
**Independent Test**: Load Platform Dashboard; confirm only platform events appear.

- [x] T003 [US1] In `backend/app/Controllers/Platform/DashboardController.php`, add a `like('action', 'platform.', 'after')` filter to the `platform_audit` query in the `activity()` method.
- [x] T004 [US1] Validate US1 via curl: Request platform activity endpoint and confirm all actions begin with `platform.`.

## Phase 3: US2 - Tenant User Sees Only Their Own Tenant's Activity (T005-T008)

**Goal**: Ensure tenant dashboard shows a multi-source feed scoped to their tenant.
**Independent Test**: Load Tenant Dashboard; confirm payments, enrollments, status changes, and leave requests appear (if data exists), and no platform/cross-tenant data appears.

- [x] T005 [P] [US2] Update `backend/app/Controllers/Api/DashboardController.php` `activity()` method to query top N `payments` for the tenant.
- [x] T006 [P] [US2] Update `backend/app/Controllers/Api/DashboardController.php` `activity()` method to query top N `enrollments`, `student_status_history`, and `leave_requests` for the tenant.
- [x] T007 [US2] In `backend/app/Controllers/Api/DashboardController.php`, merge the arrays, sort them by timestamp in descending order, slice to the top N limit, and map to the unified `ActivityItem` structure.
- [x] T008 [US2] Validate US2 via curl: Request tenant activity endpoint and confirm varied event types are returned with proper tenant isolation.

## Phase 4: US3 - Empty States Are Handled Gracefully (T009-T010)

**Goal**: Ensure friendly UI when no activity exists.
**Independent Test**: View dashboards on fresh tenants/platforms.

- [x] T009 [US3] Update `frontend/src/components/dashboard/ActivityFeed.tsx` to dynamically select the correct icon and color tone based on the event type (`payment`, `enrollment`, `status_change`, `leave`).
- [x] T010 [US3] Verify empty states logic in `frontend/src/components/dashboard/ActivityFeed.tsx` and `frontend/src/admin/pages/Dashboard.tsx` (already partially present, confirm it renders correctly with new types).

## Phase 5: Polish & Validation (T011-T013)

- [x] T011 Run PHP linting (`php -l`) on modified backend controllers.
- [x] T012 Run TypeScript compiler (`npx tsc --noEmit`) to verify frontend type safety.
- [x] T013 Update `specs/082-fix-recent-activity-scope/quickstart.md` with final live cURL output evidence from local validation.
