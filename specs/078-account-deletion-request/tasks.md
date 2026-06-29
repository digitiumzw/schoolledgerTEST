# Tasks: Account Deletion Request

**Feature**: 078-account-deletion-request  
**Input**: Design documents from `/specs/078-account-deletion-request/`  
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Endpoint-level curl validation per Constitution Principle X.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations and core infrastructure

- [ ] T001 Create migration `backend/app/Database/Migrations/2026-05-19-000001_AddDeletionFieldsToTenants.php` adding `deletion_requested_at` DATETIME and `status` ENUM to tenants table with indexes
- [ ] T002 Create migration `backend/app/Database/Migrations/2026-05-19-000002_CreateDeletionAuditLogTable.php` creating deletion_audit_log table with indexes
- [ ] T003 [P] Apply migrations with `php spark migrate` and verify schema changes

**Checkpoint**: Database schema ready for deletion feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Extend `backend/app/Models/TenantModel.php` with deletion scope methods: `getPendingDeletion()`, `getExpiredDeletions()`, `getRemainingDays()`, `isDeletionExpired()`
- [ ] T005 Create `backend/app/Models/DeletionAuditLogModel.php` with CRUD methods and `getByTenant()`, `markCompleted()`, `markCanceled()`
- [ ] T006 Create `backend/app/Services/TenantDeletionService.php` with core business logic: `requestDeletion()`, `undoDeletion()`, `canUndo()`, `validateConfirmation()`
- [ ] T007 Create `backend/app/Services/TenantDeletionEmailService.php` with `sendReminderEmail()`, `getDaysRemainingMessage()` using existing CodeIgniter email library
- [ ] T008 Add TypeScript interfaces to `frontend/src/types/dashboard.ts`: `TenantDeletionStatus`, `DeletionRequestInput`, `DeletionRequestResponse`, `UndoDeletionInput`, `UndoDeletionResponse`
- [ ] T009 Add API methods to `frontend/src/api/api.ts`: `getTenantDeletionStatus()`, `requestAccountDeletion()`, `undoAccountDeletion()` with proper typing

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Request Account Deletion (Priority: P1) 🎯 MVP

**Goal**: Tenant admins can request account deletion, starting 7-day grace period with UI feedback

**Independent Test**: Navigate to Settings → Account, click "Request Account Deletion", verify status changes to "Pending Deletion", see countdown banner

### Validation for User Story 1

> **NOTE: Run endpoint validation AFTER implementation using curl URL requests.**

- [ ] T010 [P] [US1] Curl validation: `GET /api/tenant/deletion-status` happy path (active status), error path (401 unauthorized), tenant isolation
- [ ] T011 [P] [US1] Curl validation: `POST /api/tenant/deletion-request` happy path, missing confirmation error (400), duplicate request error (409)

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create `backend/app/Controllers/Api/TenantDeletionController.php` with `getStatus()` method returning deletion status and remaining days calculation
- [ ] T013 [US1] Implement `requestDeletion()` in `TenantDeletionController.php` with `confirmDelete` validation, role check, audit log creation
- [ ] T014 [P] [US1] Add routes in `backend/app/Config/Routes.php`: `GET /api/tenant/deletion-status`, `POST /api/tenant/deletion-request` (protected by JWTAuthFilter)
- [ ] T015 [US1] Create `frontend/src/hooks/useTenantDeletion.ts` with `useTenantDeletionStatus()` query and `useRequestDeletion()` mutation exposing `isPending`
- [ ] T016 [US1] Create `frontend/src/components/settings/AccountDeletionCard.tsx` with "Request Account Deletion" button, confirmation dialog, loading state
- [ ] T017 [US1] Integrate AccountDeletionCard into Settings page with warning banner showing during grace period (remaining days from backend)
- [ ] T018 [US1] Ensure backend API returns view-ready data including `remainingDays`, `canUndo`, `expiresAt` - no client-side date calculations

**Checkpoint**: User Story 1 complete - deletion request flow functional and testable

---

## Phase 4: User Story 2 - Undo Deletion Request (Priority: P1)

**Goal**: Tenant admins can cancel deletion request during grace period, restoring account immediately

**Independent Test**: Click "Undo Account Deletion" during grace period, verify account restored to "Active", UI returns to normal state

### Validation for User Story 2

- [ ] T019 [P] [US2] Curl validation: `POST /api/tenant/undo-deletion` happy path, missing confirmation error (400), no pending deletion error (400), expired grace period error (400)

### Implementation for User Story 2

- [ ] T020 [US2] Implement `undoDeletion()` in `TenantDeletionController.php` with `confirmUndo` validation, tenant existence check, status restoration
- [ ] T021 [US2] Update `TenantDeletionService.php` with `undoDeletion()` method clearing timestamp, updating audit log to canceled
- [ ] T022 [P] [US2] Add route in `backend/app/Config/Routes.php`: `POST /api/tenant/undo-deletion`
- [ ] T023 [US2] Add `useUndoDeletion()` mutation to `frontend/src/hooks/useTenantDeletion.ts` with `isPending` state
- [ ] T024 [US2] Update `AccountDeletionCard.tsx` with "Undo Account Deletion" button (shown during grace period), confirmation dialog, loading state
- [ ] T025 [US2] Ensure React Query cache invalidation after undo: `queryClient.invalidateQueries(['tenant', 'deletion-status'])`

**Checkpoint**: User Story 2 complete - undo flow functional and testable

---

## Phase 5: User Story 3 - Automated Deletion Processing (Priority: P1)

**Goal**: Super Admin CLI command processes expired deletion requests and permanently removes tenant data

**Independent Test**: Run `php spark tenants:process-deletion`, verify expired tenants deleted with data purged, audit log updated

### Validation for User Story 3

- [ ] T026 [P] [US3] Curl validation (CLI output verification): Run command with no expired deletions, verify output shows "No expired deletion requests found"
- [ ] T027 [P] [US3] Curl validation: Create test tenant with 8-day-old deletion request, run command, verify tenant and all data removed from database

### Implementation for User Story 3

- [ ] T028 [US3] Create `backend/app/Commands/TenantDeletion.php` Spark command with `run()` method locating expired deletions (7+ days old)
- [ ] T029 [US3] Implement data deletion sequence in `TenantDeletionService.php`: `permanentlyDeleteTenant()` with ordered table deletion (child-to-parent)
- [ ] T030 [P] [US3] Add deletion methods for each tenant-scoped table: `deleteStudentAttendance()`, `deletePayments()`, `deleteCharges()`, `deleteStudents()`, `deleteClasses()`, `deleteUsers()`, etc.
- [ ] T031 [US3] Implement audit log completion: `markDeletionCompleted()` updating audit log status after successful data removal
- [ ] T032 [US3] Add CLI output formatting with summary statistics: tenants processed, records removed, execution time
- [ ] T033 [US3] Add error handling: catch exceptions during deletion, log failures, continue to next tenant, exit with error code if any failures

**Checkpoint**: User Story 3 complete - automated deletion processing functional

---

## Phase 6: User Story 4 - Deletion Reminder Emails (Priority: P2)

**Goal**: System sends reminder emails at 3-day intervals (Day 4 and Day 7) during grace period

**Independent Test**: Run `php spark tenants:process-deletion` with tenants at Day 3 and Day 6, verify emails sent with correct remaining days

### Validation for User Story 4

- [ ] T034 [P] [US4] Curl validation (email log verification): Create tenant with deletion requested 3 days ago, run command, verify Day 4 reminder email sent
- [ ] T035 [P] [US4] Curl validation: Create tenant with deletion requested 6 days ago, run command, verify Day 7 final reminder email sent

### Implementation for User Story 4

- [ ] T036 [US4] Implement `sendDay4Reminders()` in `TenantDeletionCommand.php` finding tenants with `deletion_requested_at = DATE_SUB(CURDATE(), INTERVAL 3 DAY)`
- [ ] T037 [US4] Implement `sendDay7Reminders()` in `TenantDeletionCommand.php` finding tenants with `deletion_requested_at = DATE_SUB(CURDATE(), INTERVAL 6 DAY)`
- [ ] T038 [US4] Create email templates in `TenantDeletionEmailService.php`: `sendDay4Reminder()`, `sendDay7Reminder()` with subject lines and undo instructions
- [ ] T039 [US4] Add email content with dynamic remaining days calculation and Settings → Account undo link
- [ ] T040 [US4] Update CLI command `run()` method to call reminder methods before processing expired deletions
- [ ] T041 [US4] Add reminder statistics to CLI output: "Day 4 Reminders: X sent", "Day 7 Reminders: Y sent"

**Checkpoint**: User Story 4 complete - reminder email system functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T042 [P] PHP lint validation: `php -l backend/app/Controllers/Api/TenantDeletionController.php`, `php -l backend/app/Commands/TenantDeletion.php`, `php -l backend/app/Services/TenantDeletionService.php`
- [ ] T043 [P] TypeScript type-check: `cd frontend && npx tsc --noEmit --pretty false`
- [ ] T044 [P] ESLint validation on new/modified frontend files: `npx eslint src/hooks/useTenantDeletion.ts src/components/settings/AccountDeletionCard.tsx`
- [ ] T045 [P] Verify no client-side filtering, searching, sorting, pagination, or business computations in frontend - all data processing backend-driven
- [ ] T046 Verify all mutations show loading indicators: `useRequestDeletion()` and `useUndoDeletion()` expose `isPending`, AccountDeletionCard shows loading state
- [ ] T047 Verify React Query cache invalidation: `invalidateQueries(['tenant', 'deletion-status'])` called after successful request and undo mutations
- [ ] T048 Verify action controls disabled during in-flight requests: buttons disabled when `isPending` is true
- [ ] T049 Run full quickstart.md validation: all curl scenarios pass, CLI command works, database state verified
- [ ] T050 [P] git diff --check: verify no trailing whitespace, no missing newlines at EOF
- [ ] T051 [P] Cron job documentation: Add example crontab entry to quickstart.md for `0 3 * * * php spark tenants:process-deletion`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T003) - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion (T004-T009)
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 P1 → US2 P1 → US3 P1 → US4 P2)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (T004-T009) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Integrates with US1 endpoints but independently testable
- **User Story 3 (P3)**: Can start after Foundational - Uses same services as US1/US2 but CLI-only execution
- **User Story 4 (P4)**: Can start after US3 (T028-T033) - Extends same CLI command with email functionality

### Within Each User Story

- Curl validation tasks (T010-T011, T019, T026-T027, T034-T035) MUST run after implementation
- Backend models/services before controllers
- Backend controllers before frontend hooks
- Frontend hooks before UI components
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel
- All Foundational tasks (T004-T009) can run in parallel (within Phase 2)
- Once Foundational phase completes, US1 and US2 can start in parallel
- US3 can start after Foundational, in parallel with US1/US2
- US4 should start after US3 CLI command structure is in place
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members
- All validation tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all backend tasks for User Story 1 together:
Task: "Create TenantDeletionController.php with getStatus() method"
Task: "Implement requestDeletion() in TenantDeletionController.php"
Task: "Add routes in Routes.php"

# Launch frontend tasks:
Task: "Create useTenantDeletion.ts hook"
Task: "Create AccountDeletionCard.tsx component"

# After implementation, run validation:
Task: "Curl validation for GET /api/tenant/deletion-status"
Task: "Curl validation for POST /api/tenant/deletion-request"
```

---

## Implementation Strategy

### MVP First (User Story 1 + US2 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009)
3. Complete Phase 3: User Story 1 (T010-T018)
4. Complete Phase 4: User Story 2 (T019-T025)
5. **STOP and VALIDATE**: Test deletion request and undo flows independently
6. Deploy/demo MVP (users can request and undo deletion)
7. Add US3 + US4 later for automated processing and reminders

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - can request deletion!)
3. Add User Story 2 → Test independently → Deploy/Demo (can undo deletion!)
4. Add User Story 3 → Test independently → Deploy/Demo (automated deletion!)
5. Add User Story 4 → Test independently → Deploy/Demo (reminder emails!)
6. Run Polish phase → Complete feature

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T009)
2. Once Foundational is done:
   - Developer A: User Story 1 (deletion request UI + API)
   - Developer B: User Story 2 (undo deletion UI + API)
   - Developer C: User Story 3 (CLI command + data deletion)
3. After US3 complete:
   - Developer A or C: User Story 4 (reminder emails)
4. Stories complete and integrate independently
5. Polish phase together (T042-T051)

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Setup | 3 | Database migrations |
| Foundational | 6 | Models, services, types, API methods |
| US1 (P1) | 9 | Request deletion, UI, validation |
| US2 (P1) | 7 | Undo deletion, UI, validation |
| US3 (P1) | 6 | CLI command, data deletion, audit |
| US4 (P2) | 6 | Reminder emails, CLI integration |
| Polish | 10 | Validation, lint, documentation |
| **Total** | **47** | |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify curl tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
