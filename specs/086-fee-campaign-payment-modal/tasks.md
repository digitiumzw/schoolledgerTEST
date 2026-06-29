# Tasks: Fee Campaign Payment in Record Payment Modal

**Input**: Design documents from `/specs/086-fee-campaign-payment-modal/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Frontend validation and regression curl validation per quickstart.md. Per the constitution, endpoint-level curl validation MUST be run after implementation for new or changed API behavior; for this frontend-only feature, curl validation serves as regression testing of existing endpoints.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing Feature 059 infrastructure is available and compatible

- [ ] T001 Verify `FeeCampaign`, `StudentCampaignMembership`, and related campaign API methods are available in `frontend/src/api/api.ts` and `frontend/src/types/dashboard.ts`
- [ ] T002 [P] Verify `frontend/src/hooks/useFeeCampaigns.ts` exposes the required methods (`loadCampaigns`, `getCampaignStudents`, `addStudent`, `recordPayment`) with `isPending` states

**Checkpoint**: Existing campaign module is confirmed operational and accessible from the frontend

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add campaign-related state and data fetching infrastructure to `RecordPaymentModal.tsx` before any user story UI work

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete

- [ ] T003 Add campaign payment mode state to `frontend/src/components/modals/RecordPaymentModal.tsx`: `campaignPaymentMode`, `campaigns`, `studentCampaigns`, `selectedCampaignId`, `campaignsLoading`, `isEnrolledInSelected`
- [ ] T004 [P] Implement concurrent data fetching effect in `RecordPaymentModal.tsx`: fetch active campaigns via `api.getFeeCampaigns({ status: 'active', limit: 100 })` and student memberships via `api.getStudentCampaigns(studentId)` when `campaignPaymentMode` is enabled and a student is selected
- [ ] T005 Implement `resetCampaignState()` helper in `RecordPaymentModal.tsx` that clears all campaign-related state when `campaignPaymentMode` is toggled off or student changes
- [ ] T006 Derive `isEnrolledInSelected` and `selectedCampaign` from `campaigns` + `studentCampaigns` + `selectedCampaignId` in `RecordPaymentModal.tsx`

**Checkpoint**: Campaign state, data fetching, and cleanup are fully wired in the modal. User story UI work can now begin.

---

## Phase 3: User Story 1 - Pay into Campaign for Unenrolled Student (Priority: P1) 🎯 MVP

**Goal**: An admin can select a student not enrolled in any campaigns, enable Fee Campaign Payment mode, select an active campaign, and submit. The frontend auto-enrolls the student and records the payment in a single interaction.

**Independent Test**: Open Record Payment modal for a student with no campaign memberships, enable campaign mode, select a campaign, submit, and verify the student appears in the campaign with the payment applied.

### Validation for User Story 1

- [ ] T007 [P] [US1] Frontend validation: test auto-enroll + payment flow for unenrolled student via manual UI test
- [ ] T008 [P] [US1] Curl regression: `POST /api/fee-campaigns/{id}/students` then `POST /api/fee-campaigns/{id}/record-payment` for a new student (happy path)

### Implementation for User Story 1

- [ ] T009 [US1] Add "Fee Campaign Payment" toggle/checkbox UI below the payment method selector in `RecordPaymentModal.tsx`
- [ ] T010 [US1] Hide standard category selector and multi-category "Split across categories" toggle when `campaignPaymentMode` is active in `RecordPaymentModal.tsx`
- [ ] T011 [US1] Add campaign dropdown UI in `RecordPaymentModal.tsx` that displays all active campaigns with empty-state handling
- [ ] T012 [US1] Implement amount input auto-populate with selected campaign's `remainingAmount` (expectedAmount - paidAmount) when a campaign is selected in `RecordPaymentModal.tsx`
- [ ] T013 [US1] Implement submission flow in `RecordPaymentModal.tsx` for unenrolled students: call `api.addCampaignStudent()` first, then on success call `api.recordCampaignPayment()`; on error show toast and keep modal open
- [ ] T014 [US1] Ensure `submitting` flag and disabled controls cover the entire sequential mutation (addStudent + recordPayment) in `RecordPaymentModal.tsx`
- [ ] T015 [P] [US1] Add cache invalidation after successful campaign payment: `student-balance`, `payments-with-students`, `dashboard/activity`, `fee-campaigns`, `student-campaigns` query keys

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. An admin can record a campaign payment for any student via the modal, with auto-enrollment handled transparently.

---

## Phase 4: User Story 2 - Pay into Student's Existing Campaign (Priority: P1)

**Goal**: When a student is already enrolled in one or more active campaigns, the dropdown visually distinguishes those campaigns and allows the admin to record incremental payments directly against them.

**Independent Test**: Open Record Payment modal for a student already in an active campaign, enable campaign mode, verify the existing campaign is marked with contextual data, select it, submit a partial payment, and verify the campaign's paid amount increases.

### Validation for User Story 2

- [ ] T016 [P] [US2] Frontend validation: test payment against student's existing campaign via manual UI test
- [ ] T017 [P] [US2] Curl regression: `POST /api/fee-campaigns/{id}/record-payment` for an already-enrolled student (happy path)

### Implementation for User Story 2

- [ ] T018 [US2] Add "Member" badge to campaign dropdown items in `RecordPaymentModal.tsx` when the student is already enrolled in that campaign
- [ ] T019 [US2] Display contextual campaign data in dropdown items: expectedAmount, paidAmount, remainingAmount for member campaigns in `RecordPaymentModal.tsx`
- [ ] T020 [US2] Implement direct payment submission path in `RecordPaymentModal.tsx` when `isEnrolledInSelected === true` (skip auto-enrollment, call `api.recordCampaignPayment()` directly)
- [ ] T021 [P] [US2] Ensure campaign dropdown is disabled/loading while campaign data is being fetched in `RecordPaymentModal.tsx`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Admins can pay into campaigns for both new and existing members.

---

## Phase 5: User Story 3 - Campaign Payment Guardrails and Error Handling (Priority: P2)

**Goal**: The system prevents invalid campaign payments and provides clear feedback for error scenarios (closed campaigns, enrollment failures, amount violations, state management).

**Independent Test**: Attempt to submit campaign payments in various error states (closed campaign, missing campaign selection, toggle-off mid-flow) and verify appropriate error messages and safe state handling.

### Validation for User Story 3

- [ ] T022 [P] [US3] Frontend validation: test error paths via manual UI test (closed campaign 409, overpayment 400, missing campaign selection)
- [ ] T023 [P] [US3] Curl regression: `POST /api/fee-campaigns/{id}/record-payment` against closed campaign returns 409; amount exceeding remaining returns 400

### Implementation for User Story 3

- [ ] T024 [US3] Surface backend error messages from `addCampaignStudent` and `recordCampaignPayment` failures as toast notifications in `RecordPaymentModal.tsx` without closing the modal
- [ ] T025 [US3] Add form validation in `RecordPaymentModal.tsx`: require campaign selection before submit when in campaign mode; show validation error if no campaign selected
- [ ] T026 [US3] Handle the case where `addCampaignStudent` succeeds but `recordCampaignPayment` fails: student remains enrolled, modal stays open with error, admin can retry payment
- [ ] T027 [US3] Ensure campaign selection and related state are fully reset when `campaignPaymentMode` is toggled off mid-form in `RecordPaymentModal.tsx`
- [ ] T028 [P] [US3] Add defensive check: if campaigns fetch fails or returns empty, show appropriate empty state in dropdown and disable submit in `RecordPaymentModal.tsx`

**Checkpoint**: All user stories should now be independently functional with robust error handling.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, constitution compliance, and final validation

- [ ] T029 [P] Verify frontend performs no client-side filtering, searching, sorting, pagination, or aggregations on campaign data; it only renders backend-prepared responses
- [ ] T030 [P] Verify all mutation actions (submit campaign payment, toggle mode) show a loading indicator; action controls are disabled during in-flight requests; affected React Query caches are invalidated after each mutation; no stale data flashes post-mutation
- [ ] T031 [P] Verify payment receipt generated after campaign payment includes campaign name in its details
- [ ] T032 [P] Run PHP lint on any backend files that may have been touched (exit 0 expected for unchanged files)
- [ ] T033 [P] Run TypeScript type-check: `cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false` (exit 0)
- [ ] T034 [P] Run targeted ESLint on `RecordPaymentModal.tsx`: `./node_modules/.bin/eslint src/components/modals/RecordPaymentModal.tsx`
- [ ] T035 [P] Run `git diff --check` to verify no whitespace or formatting issues
- [ ] T036 Run full curl validation per `quickstart.md` (all 12 scenarios)
- [ ] T037 Update `quickstart.md` with validation results and any deviations found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user story UI work
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories. MVP scope.
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — Builds on US1's dropdown infrastructure but is independently testable
- **User Story 3 (P2)**: Can start after US1 and US2 are functionally complete — Adds guardrails and error handling on top of core payment flows

### Within Each User Story

- Frontend validation tasks MUST run after implementation
- UI components before submission logic
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001, T002)
- All Foundational tasks marked [P] can run in parallel (T003–T006 have some dependency ordering)
- Once Foundational phase completes, US1 and US2 can start in parallel (they share the same dropdown infrastructure)
- US3 error handling can be partially parallelized with US2 once US1 core flow is working
- All Polish tasks marked [P] can run in parallel (T029–T035)

---

## Parallel Example: User Story 1

```bash
# Launch foundational state setup:
Task: "Add campaign payment mode state to RecordPaymentModal.tsx"
Task: "Implement concurrent data fetching effect in RecordPaymentModal.tsx"
Task: "Implement resetCampaignState() helper in RecordPaymentModal.tsx"
Task: "Derive isEnrolledInSelected and selectedCampaign in RecordPaymentModal.tsx"

# Once foundational is done, launch US1 UI work in parallel:
Task: "Add Fee Campaign Payment toggle/checkbox UI in RecordPaymentModal.tsx"
Task: "Hide standard category selector when campaignPaymentMode is active"
Task: "Add campaign dropdown UI in RecordPaymentModal.tsx"
Task: "Implement amount input auto-populate with remainingAmount"

# Then submission flow (depends on UI tasks):
Task: "Implement submission flow for unenrolled students in RecordPaymentModal.tsx"
Task: "Ensure submitting flag covers the entire sequential mutation"
Task: "Add cache invalidation after successful campaign payment"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (toggle + dropdown + auto-enroll + pay)
4. **STOP and VALIDATE**: Manual UI test the auto-enroll flow; verify curl happy path
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Run Polish phase → Full validation → Final deploy
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (core toggle + dropdown + auto-enroll flow)
   - Developer B: User Story 2 (member badges + contextual data + direct pay path)
3. Stories integrate naturally since they share the same modal component
4. Developer C: User Story 3 (error handling + guardrails) once core flows are functional

---

## Notes

- [P] tasks = different files or independent logic blocks, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (where applicable)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- No backend files are expected to change for this feature; all work is in `frontend/src/components/modals/RecordPaymentModal.tsx`
