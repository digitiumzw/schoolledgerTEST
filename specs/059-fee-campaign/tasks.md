# Tasks: Fee Campaign

**Input**: Design documents from `/specs/059-fee-campaign/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Integration tests included per Constitution Principle X.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/`, `backend/tests/`
- **Frontend**: `frontend/src/`
- Paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations and project scaffolding

- [ ] T001 [P] Create `fee_campaigns` table migration in `backend/app/Database/Migrations/2026-05-04-100001_Create_fee_campaigns_table.php` — columns: id (VARCHAR(50) PK), tenant_id (VARCHAR(50) NOT NULL FK), name (VARCHAR(255) NOT NULL), description (TEXT NULL), target_scope_type (VARCHAR(20) NOT NULL), target_scope_id (TEXT NULL), amount (DECIMAL(10,2) NOT NULL), due_date (DATE NULL), status (VARCHAR(10) NOT NULL DEFAULT 'active'), created_by (VARCHAR(50) NULL), created_at, updated_at. Indexes: idx_fc_tenant_id, UNIQUE uq_fc_tenant_name on (tenant_id, name). Down() drops table.
- [ ] T002 [P] Create `campaign_students` table migration in `backend/app/Database/Migrations/2026-05-04-100002_Create_campaign_students_table.php` — columns: id (VARCHAR(50) PK), tenant_id (VARCHAR(50) NOT NULL FK), fee_campaign_id (VARCHAR(50) NOT NULL FK), student_id (VARCHAR(50) NOT NULL FK), expected_amount (DECIMAL(10,2) NOT NULL), paid_amount (DECIMAL(10,2) NOT NULL DEFAULT 0.00), status (VARCHAR(20) NOT NULL DEFAULT 'unpaid'), created_at, updated_at. Indexes: idx_cs_tenant_id, idx_cs_campaign_id, idx_cs_student_id, UNIQUE uq_cs_campaign_student on (fee_campaign_id, student_id). Down() drops table.
- [ ] T003 [P] Create additive migration `backend/app/Database/Migrations/2026-05-04-100003_Add_fee_campaign_id_to_payments.php` — add fee_campaign_id (VARCHAR(50) NULL) column to payments table with index idx_pay_fee_campaign_id. Down() drops the column.

**Checkpoint**: Database schema ready — run `php spark migrate` to apply.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Models, service stub, routes, frontend types, and existing-code modifications that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create `FeeCampaignModel` in `backend/app/Models/FeeCampaignModel.php` — table fee_campaigns, allowedFields per data-model.md, useTimestamps = true. Methods: getByTenant($tenantId, $status = null), getByIdAndTenant($id, $tenantId), formatForApi($row) mapping snake_case → camelCase (decodeScopeId for target_scope_id per feature 057 pattern). Include getSummary($campaignId, $tenantId) method returning totalStudents, totalExpected, totalCollected, totalOutstanding, fullyPaidCount, partiallyPaidCount, unpaidCount via aggregate SQL on campaign_students.
- [ ] T005 [P] Create `CampaignStudentModel` in `backend/app/Models/CampaignStudentModel.php` — table campaign_students, allowedFields per data-model.md, useTimestamps = true. Methods: getByCampaign($campaignId, $tenantId, $status = null), getByStudentAndTenant($studentId, $tenantId), formatForApi($row) (compute remainingAmount = expectedAmount - paidAmount).
- [ ] T006 [P] Add `fee_campaign_id` to PaymentModel allowedFields and formatForApi output in `backend/app/Models/PaymentModel.php` — add 'fee_campaign_id' to $allowedFields array, add 'feeCampaignId' => $row['fee_campaign_id'] ?? null to formatForApi.
- [ ] T007 [P] Add fee_campaign_id IS NULL filter to LedgerService payment queries in `backend/app/Services/LedgerService.php` — (1) getStudentBalance: add ->where('fee_campaign_id', null) to feePayments query (line ~78), transportDirect query (line ~90), transportCategory query (line ~97). (2) getAllBalances: add AND fee_campaign_id IS NULL to both fee_payments subquery (line ~205) and trans_payments subquery (line ~212). (3) allocatePaymentToCharges: add ->where('fee_campaign_id', null) to feePaymentsRow query (line ~295) and transportDirect query (line ~338) and transportCategory query (line ~345).
- [ ] T008 [P] Create `FeeCampaignService` stub in `backend/app/Services/FeeCampaignService.php` — constructor accepts $db. Method stubs (empty or minimal): createCampaign(), resolveEligibleStudents(), recordPayment(), addStudent(), removeStudent(), closeCampaign(). Service will be filled in user story phases.
- [ ] T009 [P] Add fee-campaigns route block in `backend/app/Config/Routes.php` inside the api group — static routes before parameterised: GET fee-campaigns, POST fee-campaigns, GET fee-campaigns/(:segment)/students, POST fee-campaigns/(:segment)/students, DELETE fee-campaigns/(:segment)/students/(:segment), POST fee-campaigns/(:segment)/record-payment, POST fee-campaigns/(:segment)/close, GET fee-campaigns/(:segment), PUT fee-campaigns/(:segment). Add GET students/(:segment)/campaigns route to StudentController section.
- [ ] T010 [P] Add campaign TypeScript interfaces and API stubs in `frontend/src/api/api.ts` — interfaces: FeeCampaign, FeeCampaignSummary, CampaignStudent, StudentCampaignMembership, CreateCampaignInput, RecordCampaignPaymentInput. API functions: getFeeCampaigns(status?), createFeeCampaign(input), getFeeCampaign(id), updateFeeCampaign(id, input), closeFeeCampaign(id, force?), getCampaignStudents(campaignId, status?), addCampaignStudent(campaignId, studentId), removeCampaignStudent(campaignId, studentId, force?), recordCampaignPayment(campaignId, input), getStudentCampaigns(studentId).
- [ ] T011 [P] Add campaign types to `frontend/src/types/dashboard.ts` — export FeeCampaign, CampaignStudent, StudentCampaignMembership, FeeCampaignSummary interfaces matching API contract shapes.

**Checkpoint**: Foundation ready — models, service stub, routes, types, and ledger isolation in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Create & Auto-Assign Fee Campaign (Priority: P1) 🎯 MVP

**Goal**: Admin can create a campaign targeting a class or school-wide scope, and all eligible active students are auto-assigned with individual tracking records.

**Independent Test**: Create a campaign for a class, verify all active students receive campaign records with expected amount and zero paid, confirm campaign list shows correct counts.

### Integration Tests for US1

- [ ] T012 [P] [US1] Create integration test file `backend/tests/Integration/FeeCampaignTest.php` with test cases: (1) testCreateCampaignHappyPath — POST /api/fee-campaigns with valid data, assert 201 + campaign returned + assignedCount matches active students. (2) testCreateCampaignDuplicateName — assert 400 on duplicate name within tenant. (3) testCreateCampaignSchoolWide — target school_wide, verify all active students assigned. (4) testCreateCampaignEmptyClass — target a class with no active students, assert campaign created with assignedCount=0. (5) testCreateCampaignTenantIsolation — verify campaign from tenant A not visible to tenant B. (6) testGetCampaignList — GET /api/fee-campaigns, verify summary aggregates. (7) testGetCampaignDetail — GET /api/fee-campaigns/:id, verify full detail with summary.

### Implementation for US1

- [ ] T013 [US1] Implement `FeeCampaignService::createCampaign()` in `backend/app/Services/FeeCampaignService.php` — validate inputs (name uniqueness via UNIQUE constraint, amount > 0, scope type), insert fee_campaigns row inside transaction, call resolveEligibleStudents(), bulk insertBatch() campaign_students records, return campaign data with assignedCount.
- [ ] T014 [US1] Implement `FeeCampaignService::resolveEligibleStudents()` in `backend/app/Services/FeeCampaignService.php` — school_wide: query all active students for tenant. class: decode target_scope_id (JSON array or scalar), query active students with class_id IN scope IDs. Return array of student rows.
- [ ] T015 [US1] Create `FeeCampaignController` in `backend/app/Controllers/Api/FeeCampaignController.php` extending BaseApiController — constructor instantiates FeeCampaignModel, CampaignStudentModel, FeeCampaignService. Methods: index() (GET list with optional status filter + summary per campaign), store() (POST create + auto-assign, role check admin/bursar), show() (GET detail with summary), update() (PUT metadata, guard amount change if payments exist). Each method: getTenantId(), role check, validate input, delegate to service, return success/error.
- [ ] T016 [US1] Implement campaign list summary aggregation in `FeeCampaignModel::getSummary()` in `backend/app/Models/FeeCampaignModel.php` — single SQL query: SELECT COUNT(*), SUM(expected_amount), SUM(paid_amount), COUNT(CASE status='fully_paid'), COUNT(CASE status='partially_paid'), COUNT(CASE status='unpaid') FROM campaign_students WHERE fee_campaign_id = ? AND tenant_id = ?. Return associative array.
- [ ] T017 [US1] Create `useFeeCampaigns` hook in `frontend/src/hooks/useFeeCampaigns.ts` — useQuery for campaign list (queryKey: ['fee-campaigns']), useQuery for single campaign (queryKey: ['fee-campaigns', id]), useQuery for campaign students (queryKey: ['fee-campaigns', id, 'students']), useMutation for createCampaign (invalidates ['fee-campaigns']).
- [ ] T018 [US1] Create `FeeCampaigns` list page in `frontend/src/pages/FeeCampaigns.tsx` — page header with "New Campaign" button, table/card list showing: name, scope, amount, dueDate, summary stats (totalStudents, totalCollected, totalOutstanding, status counts). Empty state when no campaigns. Click row navigates to detail page. Use shadcn/ui Table, Badge, Button, Card components.
- [ ] T019 [US1] Create `CreateCampaignModal` in `frontend/src/components/modals/CreateCampaignModal.tsx` — React Hook Form + Zod validation. Fields: name (required), description (optional), targetScopeType (Select: school_wide, class), targetScopeId (multi-class checkbox list with ScrollArea when scope=class, fetch classes from api.getClasses), amount (number, > 0), dueDate (optional date picker). On submit: call createFeeCampaign mutation, close modal, toast success with assignedCount.

**Checkpoint**: US1 complete — campaigns can be created with auto-assignment. Campaign list and detail views functional.

---

## Phase 4: User Story 2 — Record Payment Against Campaign (Priority: P1) 🎯 MVP

**Goal**: Admin can record a payment against a student's campaign record. Payment updates campaign balance AND creates a general payments table entry atomically.

**Independent Test**: Record partial and full payments, verify campaign record updates (paid, remaining, status) AND payment appears in general payment history. Verify overpayment is rejected. Verify standard ledger balance is unchanged.

### Integration Tests for US2

- [ ] T020 [P] [US2] Add test cases to `backend/tests/Integration/FeeCampaignTest.php`: (1) testRecordPaymentFullPay — record exact remaining amount, assert campaign_students.status = 'fully_paid', verify payment row in payments table with fee_campaign_id set. (2) testRecordPaymentPartialPay — assert status = 'partially_paid', paid_amount updated. (3) testRecordPaymentMultiplePartials — two partial payments summing to full, assert fully_paid. (4) testRecordPaymentOverpayment — amount exceeds remaining, assert 400 rejection. (5) testRecordPaymentFullyPaidStudent — student already fully_paid, assert 400. (6) testRecordPaymentLedgerIsolation — record campaign payment, call LedgerService::getStudentBalance(), verify balance unchanged vs before.

### Implementation for US2

- [ ] T021 [US2] Implement `FeeCampaignService::recordPayment()` in `backend/app/Services/FeeCampaignService.php` — validate: campaign exists & active (else 409), student assigned to campaign (else 404), amount > 0, amount ≤ remaining (else 400 overpayment). Inside transaction: (1) insert payments row with fee_campaign_id, receipt_number, category = campaign name, (2) update campaign_students.paid_amount += amount, (3) derive new status (unpaid/partially_paid/fully_paid), (4) update campaign_students.status. Return payment + updated campaign student data.
- [ ] T022 [US2] Add `recordPayment()` method to `FeeCampaignController` in `backend/app/Controllers/Api/FeeCampaignController.php` — POST /api/fee-campaigns/:id/record-payment. Validate studentId, amount, method (use VALID_METHODS from PaymentController), date. Delegate to service. Return 201 with payment + campaignStudent data.
- [ ] T023 [US2] Create `CampaignPaymentModal` in `frontend/src/components/modals/CampaignPaymentModal.tsx` — props: campaignId, student (CampaignStudent). Display student name, expected, paid, remaining. Form fields: amount (number, max = remaining), method (Select with same options as RecordPaymentModal), date (defaults to today), description (optional). On submit: call recordCampaignPayment mutation, invalidate campaign queries, toast success.
- [ ] T024 [US2] Add recordCampaignPayment mutation to `frontend/src/hooks/useFeeCampaigns.ts` — useMutation calling api.recordCampaignPayment, onSuccess invalidates ['fee-campaigns', id] and ['fee-campaigns', id, 'students'] query keys.

**Checkpoint**: US1 + US2 complete — full MVP. Campaigns created, students assigned, payments recorded atomically, ledger isolated.

---

## Phase 5: User Story 3 — Campaign Dashboard & Student Status View (Priority: P1)

**Goal**: Admin can view campaign dashboard with aggregate progress and drill into individual student statuses. Student profile shows campaign memberships.

**Independent Test**: View campaign detail with mixed statuses, filter by status. View student profile and confirm "Fee Campaigns" section appears separately from standard billing.

### Integration Tests for US3

- [ ] T025 [P] [US3] Add test cases to `backend/tests/Integration/FeeCampaignTest.php`: (1) testGetCampaignStudentsWithFilter — GET /api/fee-campaigns/:id/students?status=unpaid, verify only unpaid students returned. (2) testGetStudentCampaigns — GET /api/students/:id/campaigns, verify returns all campaigns the student belongs to with correct per-campaign status.

### Implementation for US3

- [ ] T026 [US3] Add `getCampaignStudents()` method to `FeeCampaignController` in `backend/app/Controllers/Api/FeeCampaignController.php` — GET /api/fee-campaigns/:id/students. Accept optional status query param. Join campaign_students with students to include studentName and className. Return formatted list with remainingAmount computed.
- [ ] T027 [US3] Add `getStudentCampaigns()` method to StudentController (or FeeCampaignController, routed as GET /api/students/:id/campaigns) in `backend/app/Controllers/Api/FeeCampaignController.php` — query campaign_students joined with fee_campaigns for the given student. Return campaignId, campaignName, campaignStatus, dueDate, expectedAmount, paidAmount, remainingAmount, status.
- [ ] T028 [US3] Create `FeeCampaignDetail` page in `frontend/src/pages/FeeCampaignDetail.tsx` — route param: campaignId. Header: campaign name, description, status Badge, dueDate. Summary cards: total expected, total collected, total outstanding, student counts by status. Student table: name, class, expected, paid, remaining, status Badge. Filter dropdown (all, fully_paid, partially_paid, unpaid). "Record Payment" button per row opens CampaignPaymentModal.
- [ ] T029 [US3] Create `StudentCampaignsCard` in `frontend/src/components/student-profile/StudentCampaignsCard.tsx` — props: studentId. useQuery for getStudentCampaigns. Display card with heading "Fee Campaigns", list of campaigns with: name, status Badge, expected, paid, remaining, dueDate. Empty state: "No fee campaigns". Card is visually separate from standard billing section.
- [ ] T030 [US3] Integrate `StudentCampaignsCard` into student profile page `frontend/src/pages/StudentProfile.tsx` — import and render StudentCampaignsCard below or alongside the existing fee/billing section, passing the student ID.
- [ ] T031 [US3] Add fee-campaigns route and navigation in `frontend/src/App.tsx` — add /fee-campaigns route (FeeCampaigns page), /fee-campaigns/:id route (FeeCampaignDetail page). Add "Fee Campaigns" item to sidebar navigation.

**Checkpoint**: US1 + US2 + US3 complete — all P1 stories done. Dashboard, filtering, and student profile integration working.

---

## Phase 6: User Story 4 — Manage Campaign Members (Priority: P2)

**Goal**: Admin can manually add or remove individual students from a campaign after creation.

**Independent Test**: Add a student to an existing campaign, remove another (with and without payments), verify campaign totals update accordingly.

### Integration Tests for US4

- [ ] T032 [P] [US4] Add test cases to `backend/tests/Integration/FeeCampaignTest.php`: (1) testAddStudentToCampaign — POST /api/fee-campaigns/:id/students, assert 201 + new record. (2) testAddDuplicateStudent — assert 400 when student already assigned. (3) testRemoveStudentNoPay — DELETE /api/fee-campaigns/:id/students/:studentId, assert 200 + record deleted. (4) testRemoveStudentWithPayNoForce — assert 409 when student has payments and force not set. (5) testRemoveStudentWithPayForce — assert 200 with force=true, verify payment records preserved in payments table.

### Implementation for US4

- [ ] T033 [US4] Implement `FeeCampaignService::addStudent()` in `backend/app/Services/FeeCampaignService.php` — validate campaign active, student belongs to tenant, not already in campaign (UNIQUE constraint handles race). Insert campaign_students row with expected_amount = campaign amount, paid_amount = 0, status = 'unpaid'. Return new record.
- [ ] T034 [US4] Implement `FeeCampaignService::removeStudent()` in `backend/app/Services/FeeCampaignService.php` — find campaign_students row. If paid_amount > 0 and force != true, return error (409). Delete campaign_students row. Do NOT delete payment rows (audit integrity per research R7). Return success.
- [ ] T035 [US4] Add `addStudent()` and `removeStudent()` methods to `FeeCampaignController` in `backend/app/Controllers/Api/FeeCampaignController.php` — POST /api/fee-campaigns/:id/students (validate studentId, delegate to service, return 201). DELETE /api/fee-campaigns/:id/students/:studentId (check force query param, delegate to service, return 200 or 409).
- [ ] T036 [US4] Add student management UI to `FeeCampaignDetail` page in `frontend/src/pages/FeeCampaignDetail.tsx` — "Add Student" button opens a modal/popover with student search (fetch from api.getStudents), select student, call addCampaignStudent mutation. "Remove" button per student row with confirmation dialog (warn if payments exist). Call removeCampaignStudent mutation. Add mutations to useFeeCampaigns hook for addStudent and removeStudent.

**Checkpoint**: US1–US4 complete — full member management. Add/remove students with payment safety guards.

---

## Phase 7: User Story 5 — Close & Archive Campaign (Priority: P3)

**Goal**: Admin can close a campaign, preventing further payments while preserving historical data.

**Independent Test**: Close a campaign, verify it moves to archived view, no further payments accepted, historical data remains visible.

### Integration Tests for US5

- [ ] T037 [P] [US5] Add test cases to `backend/tests/Integration/FeeCampaignTest.php`: (1) testCloseCampaignAllPaid — POST /api/fee-campaigns/:id/close, assert 200, status = 'closed'. (2) testCloseCampaignWithOutstandingNoForce — assert 409 when unpaid students exist and force not set. (3) testCloseCampaignWithOutstandingForce — assert 200 with force=true. (4) testPaymentOnClosedCampaign — POST record-payment on closed campaign, assert 409. (5) testAddStudentToClosedCampaign — assert 409.

### Implementation for US5

- [ ] T038 [US5] Implement `FeeCampaignService::closeCampaign()` in `backend/app/Services/FeeCampaignService.php` — check campaign exists and is active. Check if any campaign_students have status != 'fully_paid'. If outstanding and force != true, return error (409 with message). Update fee_campaigns.status = 'closed'. Return updated campaign.
- [ ] T039 [US5] Add `close()` method to `FeeCampaignController` in `backend/app/Controllers/Api/FeeCampaignController.php` — POST /api/fee-campaigns/:id/close. Read force from request body. Delegate to service. Return 200 or 409.
- [ ] T040 [US5] Add close campaign UI to `FeeCampaignDetail` page in `frontend/src/pages/FeeCampaignDetail.tsx` — "Close Campaign" button (visible when status=active). Confirmation dialog: if outstanding balances, show warning with count/amount. Force checkbox. Call closeFeeCampaign mutation. On success: refresh, show toast. When campaign is closed: disable "Record Payment" and "Add Student" buttons, show read-only badge.
- [ ] T041 [US5] Add status filter to campaign list page in `frontend/src/pages/FeeCampaigns.tsx` — Tabs or Select filter: "All", "Active", "Closed/Archived". Pass status param to getFeeCampaigns API call. Add closeCampaign mutation to useFeeCampaigns hook.

**Checkpoint**: All 5 user stories complete. Full lifecycle: create → assign → pay → manage → close.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, integration, and final quality checks

- [ ] T042 [P] Run PHP lint on all new/modified backend files: `php -l backend/app/Models/FeeCampaignModel.php backend/app/Models/CampaignStudentModel.php backend/app/Services/FeeCampaignService.php backend/app/Controllers/Api/FeeCampaignController.php`
- [ ] T043 [P] Run TypeScript type-check on frontend: `cd frontend && npx tsc --noEmit`
- [ ] T044 [P] Run ESLint on new frontend files: `cd frontend && npx eslint src/pages/FeeCampaigns.tsx src/pages/FeeCampaignDetail.tsx src/components/modals/CreateCampaignModal.tsx src/components/modals/CampaignPaymentModal.tsx src/components/student-profile/StudentCampaignsCard.tsx src/hooks/useFeeCampaigns.ts`
- [ ] T045 Run full integration test suite to verify no regressions: `cd backend && php spark test --filter FeeCampaignTest`
- [ ] T046 Validate quickstart.md flow end-to-end: create campaign, auto-assign, record payment, verify ledger isolation, close campaign

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001, T002, T003 all parallel
- **Foundational (Phase 2)**: Depends on Phase 1 — T004–T011 all parallel after migrations
- **US1 (Phase 3)**: Depends on Phase 2 — T012 parallel with T013–T019
- **US2 (Phase 4)**: Depends on US1 (needs campaign + students to exist) — T020 parallel with T021–T024
- **US3 (Phase 5)**: Depends on US1 + US2 (needs campaigns with payment data for dashboard) — T025 parallel with T026–T031
- **US4 (Phase 6)**: Depends on US1 (needs campaigns to manage members) — can run parallel with US2/US3 if needed
- **US5 (Phase 7)**: Depends on US1 + US2 (needs to test closed-campaign payment guard)
- **Polish (Phase 8)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — foundational for all other stories
- **US2 (P1)**: Depends on US1 — needs campaigns and assigned students to record payments against
- **US3 (P1)**: Depends on US1 + US2 — needs payment data for dashboard views
- **US4 (P2)**: Depends on US1 — needs campaigns to manage members (independent of US2/US3)
- **US5 (P3)**: Depends on US1 + US2 — needs to verify payment guard on closed campaigns

### Within Each User Story

- Integration tests can be written in parallel with implementation
- Service methods before controller methods
- Controller methods before frontend pages
- Models/hooks before components

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 — all different migration files
- **Phase 2**: T004–T011 — all different files (models, service, routes, types)
- **Phase 3**: T012 parallel with T013–T14 (test + service). T17–T19 parallel (frontend files)
- **Phase 4**: T020 parallel with T021. T023, T024 parallel (frontend files)
- **Phase 5**: T025 parallel with T026–T027. T028, T029 parallel (frontend files)
- **Phase 6**: T032 parallel with T033–T034. T036 single file
- **Phase 7**: T037 parallel with T038. T040, T041 parallel (different pages)
- **Phase 8**: T042, T043, T044 — all independent lint/check commands

---

## Parallel Example: Phase 2 (Foundational)

```bash
# All 8 tasks can run in parallel — each touches a different file:
T004: backend/app/Models/FeeCampaignModel.php
T005: backend/app/Models/CampaignStudentModel.php
T006: backend/app/Models/PaymentModel.php (additive)
T007: backend/app/Services/LedgerService.php (additive)
T008: backend/app/Services/FeeCampaignService.php
T009: backend/app/Config/Routes.php (additive)
T010: frontend/src/api/api.ts (additive)
T011: frontend/src/types/dashboard.ts (additive)
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup (3 migrations)
2. Complete Phase 2: Foundational (8 files, all parallel)
3. Complete Phase 3: US1 — Create & Auto-Assign (7 tasks)
4. Complete Phase 4: US2 — Record Payment (5 tasks)
5. **STOP and VALIDATE**: Test MVP independently — create campaign, assign students, record payments, verify ledger isolation
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test campaign creation independently
3. Add US2 → Test payment recording → **Deploy/Demo (MVP!)**
4. Add US3 → Dashboard + student profile integration → Deploy
5. Add US4 → Member management → Deploy
6. Add US5 → Close/archive → Deploy
7. Polish → Final validation

### Task Counts by Phase

| Phase | Story | Tasks | Parallel |
|-------|-------|-------|----------|
| 1 Setup | — | 3 | 3 |
| 2 Foundational | — | 8 | 8 |
| 3 US1 | P1 MVP | 8 | 4 |
| 4 US2 | P1 MVP | 5 | 2 |
| 5 US3 | P1 | 7 | 4 |
| 6 US4 | P2 | 5 | 3 |
| 7 US5 | P3 | 5 | 3 |
| 8 Polish | — | 5 | 3 |
| **Total** | | **46** | |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable after its phase
- MVP = Phase 1–4 (US1 + US2) = **24 tasks**
- Integration tests cover: CRUD, auto-assign, payment recording, overpayment rejection, status transitions, tenant isolation, closed-campaign guard, student add/remove, ledger isolation
- Campaign payments use category = campaign name for natural report grouping
- All payment queries in LedgerService filtered by fee_campaign_id IS NULL for balance isolation
