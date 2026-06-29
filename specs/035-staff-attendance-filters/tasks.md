# Tasks: Staff Attendance Filtering and Alerts

**Input**: Design documents from `/specs/035-staff-attendance-filters/`  
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/attendance-api.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and shared component setup

- [X] T001 Create migration file `backend/app/Database/Migrations/2026-04-16-AddAttendanceComment.php` to add nullable comment column to attendance table
- [X] T002 [P] Register new attendance API routes in `backend/app/Config/Routes.php` (GET /summary, GET /today, POST /status)

**Checkpoint**: Migration and routes ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Extend `backend/app/Models/AttendanceModel.php` with method `getMonthlySummary(string $yearMonth, int $tenantId): array` for month-based filtering
- [X] T004 [P] Extend `backend/app/Models/AttendanceModel.php` with method `getTodayAttendance(int $tenantId): array` with LEFT JOIN to detect unchecked staff
- [X] T005 [P] Extend `backend/app/Models/AttendanceModel.php` with method `updateStatus(int $staffId, string $status, ?string $comment, int $tenantId): array` for absent/excused updates
- [X] T006 Create `backend/app/Controllers/Api/AttendanceController.php` with `summary()` method for GET /api/attendance/summary endpoint
- [X] T007 Extend `backend/app/Controllers/Api/AttendanceController.php` with `today()` method for GET /api/attendance/today endpoint
- [X] T008 Extend `backend/app/Controllers/Api/AttendanceController.php` with `updateStatus()` method for POST /api/attendance/{id}/status endpoint (depends on T005)
- [X] T009 [P] Create `frontend/src/api/attendance.ts` with API client functions: `getSummary()`, `getToday()`, `updateStatus()`

**Checkpoint**: Foundation ready - backend models, controller, and API client complete. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Monthly Attendance Filtering (Priority: P1) 🎯 MVP

**Goal**: Add month-based filtering to the Staff Attendance summary page, allowing administrators to filter attendance records by month with dynamic updates.

**Independent Test**: Navigate to Staff Attendance page, select a month from the filter, verify the attendance summary updates to show only records from that month. Test default to current month on page load.

### Implementation for User Story 1

- [X] T010 [P] [US1] Create `frontend/src/components/MonthFilter.tsx` - shadcn/ui Select component for YYYY-MM month selection with current month default
- [X] T011 [P] [US1] Create `frontend/src/hooks/useAttendanceFilter.ts` - React hook for month filter state management
- [X] T012 [US1] Create `frontend/src/hooks/useAttendance.ts` - React Query hook `useAttendanceSummary(month)` for fetching filtered data
- [X] T013 [US1] Modify `frontend/src/pages/StaffAttendance.tsx` - Integrate MonthFilter component and useAttendance hook to display filtered summary (depends on T010, T012)
- [X] T014 [US1] Add empty state handling in `frontend/src/pages/StaffAttendance.tsx` - Display message when no records exist for selected month

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Staff Attendance page displays monthly filter and updates correctly.

---

## Phase 4: User Story 2 - Unchecked Staff Alert System (Priority: P2)

**Goal**: Display alerts on Today's Attendance page for staff who haven't checked in, prompting administrators to confirm absent or excused status.

**Independent Test**: View Today's Attendance page when staff haven't checked in. Verify alert banner shows count of unchecked staff. Click alert to open status confirmation modal. Confirm marking as absent/excused updates the attendance record.

### Implementation for User Story 2

- [X] T015 [P] [US2] Create `frontend/src/hooks/useTodayAttendance.ts` - React Query hook for fetching today's attendance with unchecked detection
- [X] T016 [P] [US2] Create `frontend/src/components/AttendanceAlert.tsx` - Alert banner component showing unchecked staff count with call-to-action
- [X] T017 [US2] Modify `frontend/src/pages/TodaysAttendance.tsx` - Integrate AttendanceAlert and useTodayAttendance hook (depends on T015, T016)
- [X] T018 [US2] Add conditional rendering in `frontend/src/pages/TodaysAttendance.tsx` - Show alert only when unchecked_count > 0

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Today's Attendance page shows alerts for unchecked staff.

---

## Phase 5: User Story 3 - Comment Recording for Absence/Excused Status (Priority: P3)

**Goal**: Allow administrators to add optional comments when marking staff as absent or excused, with comments viewable in historical records.

**Independent Test**: Trigger alert for unchecked staff, open status modal, select absent or excused, add a comment, confirm. Verify comment is saved and visible in the staff's attendance history.

### Implementation for User Story 3

- [X] T019 [P] [US3] Create `frontend/src/components/AttendanceStatusModal.tsx` - Modal with status selection (absent/excused), comment textarea, and confirm/cancel actions
- [X] T020 [US3] Create `frontend/src/hooks/useUpdateAttendanceStatus.ts` - React Query mutation hook for calling updateStatus API with loading/error states
- [X] T021 [US3] Integrate AttendanceStatusModal with AttendanceAlert in `frontend/src/components/AttendanceAlert.tsx` - Clicking alert opens modal for specific staff member
- [X] T022 [US3] Modify `frontend/src/pages/StaffAttendance.tsx` - Display comments in attendance history table/view when present

**Checkpoint**: All user stories should now be independently functional. Status updates with comments work end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: UI polish, validation, error handling, and documentation

- [X] T023 [P] Add form validation in `frontend/src/components/AttendanceStatusModal.tsx` using Zod - Max 500 chars for comment
- [X] T024 [P] Add error handling in `frontend/src/components/AttendanceStatusModal.tsx` - Display API error messages
- [X] T025 [P] Add loading states across all attendance components (MonthFilter, AttendanceAlert, AttendanceStatusModal)
- [X] T026 Add role-based UI restrictions - Hide status update button if user lacks admin role
- [X] T027 [P] Update `CLAUDE.md` with attendance filtering and alert system development notes
- [X] T028 [P] Run quickstart.md validation - Test all scenarios in testing guide
- [X] T029 Verify all database queries include `tenant_id` filtering per Constitution Principle I

**Checkpoint**: Feature complete, documented, and constitution-compliant.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001, T002) - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 hooks pattern but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Builds on US2 alert component for modal trigger

### Within Each User Story

- Models/hooks before components
- Components before page integration
- Core implementation before error handling/validation
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel
- T003, T004, T005 can run in parallel (same file but independent methods)
- T006, T007, T008 have dependency chain (same controller file)
- T009 can run parallel to controller work
- T010, T011 can run in parallel
- T015, T016 can run in parallel
- T019 and T020 can run in parallel
- All Polish phase tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all US1 components in parallel after hooks ready:
Task: "Create MonthFilter component in frontend/src/components/MonthFilter.tsx"
Task: "Create useAttendanceFilter hook in frontend/src/hooks/useAttendanceFilter.ts"

# Then integrate (depends on above):
Task: "Modify StaffAttendance page to integrate filter and hook"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003-T009) - CRITICAL
3. Complete Phase 3: User Story 1 (T010-T014)
4. **STOP and VALIDATE**: Test month filtering independently
5. Deploy/demo if ready - Staff can filter attendance by month

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test monthly filtering → Deploy/Demo (MVP!)
3. Add User Story 2 → Test alert system → Deploy/Demo
4. Add User Story 3 → Test comments → Deploy/Demo
5. Add Polish phase → Final validation → Complete feature

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (month filtering)
   - Developer B: User Story 2 (alert system)  
   - Developer C: User Story 3 (comments) + Backend controller if needed
3. Stories complete and integrate independently

---

## Task Summary

| Phase | Task Count | Description |
|-------|------------|-------------|
| Phase 1: Setup | 2 | Migration and routes |
| Phase 2: Foundational | 7 | Backend models, controller, API client |
| Phase 3: US1 (P1) | 5 | Month filtering MVP |
| Phase 4: US2 (P2) | 4 | Alert system |
| Phase 5: US3 (P3) | 4 | Comments |
| Phase 6: Polish | 7 | Validation, error handling, docs |
| **Total** | **29** | |

**Suggested MVP Scope**: Complete through Phase 3 (User Story 1) for immediate value delivery.

---

## Notes

- Each user story is independently completable and testable
- All tasks include exact file paths for immediate execution
- Backend follows CodeIgniter 4 conventions per plan.md
- Frontend uses established patterns: TanStack Query, shadcn/ui, React Hook Form
- All database queries must include `tenant_id` (Constitution Principle I)
- Commit after each task or logical group
