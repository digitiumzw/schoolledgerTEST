# Tasks: Onboarding Guided Tutorial

**Input**: Design documents from `/specs/076-onboarding-guided-tutorial/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/onboarding-guidance-api.md, quickstart.md

**Tests**: No pre-implementation test-first tasks are included because the feature spec did not request TDD. Validation tasks are included in the final phase per Constitution Principle X.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same phase when files do not conflict
- **[Story]**: Maps to the user story from `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared schema/types/routes needed by later stories.

- [x] T001 Create migration for `setup_guide_progress` and `user_tutorial_progress` tables in `backend/app/Database/Migrations/2026-05-18-000001_CreateOnboardingGuidanceTables.php`
- [x] T002 [P] Create setup guide model skeleton in `backend/app/Models/SetupGuideProgressModel.php`
- [x] T003 [P] Create user tutorial progress model skeleton in `backend/app/Models/UserTutorialProgressModel.php`
- [x] T004 [P] Add onboarding guidance TypeScript types for setup guide and tutorial responses in `frontend/src/types/dashboard.ts`
- [x] T005 Add setup-guide and tutorial route declarations in `backend/app/Config/Routes.php`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services, API client methods, and shared UI primitives that all user stories depend on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T006 Implement setup guide step constants, status validation, and tenant-scoped helpers in `backend/app/Services/SetupGuideService.php`
- [x] T007 Implement tutorial module definitions, role filtering rules, and progress helpers in `backend/app/Services/TutorialService.php`
- [x] T008 Implement setup guide API controller methods `index`, `updateStep`, and `dismiss` in `backend/app/Controllers/Api/SetupGuideController.php`
- [x] T009 Implement tutorial API controller methods `index`, `updateProgress`, and `restart` in `backend/app/Controllers/Api/TutorialController.php`
- [x] T010 Add setup-guide and tutorial API methods and response interfaces in `frontend/src/api/api.ts`
- [x] T011 [P] Create React Query setup guide hooks in `frontend/src/hooks/useSetupGuide.ts`
- [x] T012 [P] Create React Query tutorial hooks in `frontend/src/hooks/useTutorial.ts`
- [x] T013 [P] Create shared setup guide card shell component in `frontend/src/components/onboarding/SetupGuideCard.tsx`
- [x] T014 [P] Create shared tutorial walkthrough shell component in `frontend/src/components/tutorial/TutorialWalkthrough.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Complete streamlined school onboarding (Priority: P1) 🎯 MVP

**Goal**: New school admins complete initial onboarding without fee structure setup, can enter a phone number, and land in the app with setup guidance enabled.

**Independent Test**: Create or use an onboarding admin, complete onboarding with a phone number, confirm no fee-structure onboarding step appears or is required, and confirm the app proceeds after the final non-billing onboarding step.

### Implementation for User Story 1

- [x] T015 [US1] Remove `fee-structure` from onboarding `STEPS` and `REQUIRED_STEPS` in `backend/app/Models/OnboardingProgressModel.php`
- [x] T016 [US1] Add phone number validation for onboarding profile/contact data in `backend/app/Controllers/Api/OnboardingController.php`
- [x] T017 [US1] Persist onboarding phone number to the selected user/profile or tenant/contact settings path in `backend/app/Controllers/Api/OnboardingController.php`
- [x] T018 [US1] Ensure onboarding completion no longer requires fee structure and returns setup/tutorial display flags in `backend/app/Controllers/Api/OnboardingController.php`
- [x] T019 [US1] Remove `fee-structure` from frontend onboarding step order and labels in `frontend/src/hooks/useOnboarding.ts`
- [x] T020 [US1] Add phone number field and validation to admin profile onboarding UI in `frontend/src/components/onboarding/StepAdminProfile.tsx`
- [x] T021 [US1] Remove `StepFeeStructure` rendering/import and complete onboarding after the final non-billing step in `frontend/src/pages/OnboardingPage.tsx`
- [x] T022 [US1] Remove or detach obsolete onboarding-only fee structure component usage in `frontend/src/components/onboarding/StepFeeStructure.tsx`
- [x] T023 [US1] Update onboarding progress request/response typing for phone number and completion flags in `frontend/src/api/api.ts`

**Checkpoint**: User Story 1 is independently functional and testable as the MVP.

---

## Phase 4: User Story 2 - Follow recommended setup flow after onboarding (Priority: P1)

**Goal**: After onboarding, admins see a tenant-level recommended setup flow ordered Add Staff, Add Classes, optional Add Students, Configure Fee Structure and Billing Settings.

**Independent Test**: Complete onboarding, fetch/display the setup guide, verify step order, complete early steps, skip Add Students, and confirm next action advances to billing configuration.

### Implementation for User Story 2

- [x] T024 [US2] Implement tenant-scoped setup guide retrieval with derived completion checks in `backend/app/Services/SetupGuideService.php`
- [x] T025 [US2] Implement setup step completion, optional `add-students` skip behavior, and required-step skip rejection in `backend/app/Services/SetupGuideService.php`
- [x] T026 [US2] Implement setup guide dismissal persistence in `backend/app/Services/SetupGuideService.php`
- [x] T027 [US2] Wire setup guide controller responses to contract shape for `GET /api/setup-guide`, `PATCH /api/setup-guide/steps/{stepKey}`, and `POST /api/setup-guide/dismiss` in `backend/app/Controllers/Api/SetupGuideController.php`
- [x] T028 [US2] Render ordered setup guide steps with complete/skip/dismiss actions in `frontend/src/components/onboarding/SetupGuideCard.tsx`
- [x] T029 [US2] Integrate setup guide display into the dashboard or post-onboarding landing area in `frontend/src/pages/Dashboard.tsx`
- [x] T030 [US2] Add setup guide navigation targets for Staff, Classes, Students, and Fee Structure/Billing Settings in `frontend/src/components/onboarding/SetupGuideCard.tsx`
- [x] T031 [US2] Ensure setup guide query invalidation after step update or dismiss actions in `frontend/src/hooks/useSetupGuide.ts`

**Checkpoint**: User Story 2 works independently after onboarding and does not require tutorial functionality.

---

## Phase 5: User Story 3 - Learn system modules through an in-app walkthrough (Priority: P2)

**Goal**: The onboarding administrator receives an in-app module walkthrough explaining available modules, contents, purpose, and key actions.

**Independent Test**: Log in as an onboarding administrator after completion, confirm tutorial appears, review module explanations, complete/dismiss it, and verify it does not auto-show again unless restarted.

### Implementation for User Story 3

- [x] T032 [US3] Define administrator-visible tutorial module catalog with summaries, contents, actions, routes, and order in `backend/app/Services/TutorialService.php`
- [x] T033 [US3] Implement per-user tutorial state creation and `should_show` calculation for onboarding admins in `backend/app/Services/TutorialService.php`
- [x] T034 [US3] Implement tutorial progress update validation for completed, dismissed, and in-progress states in `backend/app/Services/TutorialService.php`
- [x] T035 [US3] Wire tutorial controller responses to contract shape for `GET /api/tutorial`, `PATCH /api/tutorial/progress`, and `POST /api/tutorial/restart` in `backend/app/Controllers/Api/TutorialController.php`
- [x] T036 [US3] Render module summary, contents, primary actions, navigation, complete, dismiss, and restart controls in `frontend/src/components/tutorial/TutorialWalkthrough.tsx`
- [x] T037 [US3] Mount admin tutorial walkthrough after onboarding/dashboard load using tutorial hooks in `frontend/src/pages/Dashboard.tsx`
- [x] T038 [US3] Add tutorial restart access point in an appropriate help/account UI location in `frontend/src/components/AppSidebar.tsx`
- [x] T039 [US3] Ensure tutorial progress mutations invalidate and refresh tutorial state in `frontend/src/hooks/useTutorial.ts`

**Checkpoint**: User Story 3 works independently for administrators and does not depend on invited-user role variance.

---

## Phase 6: User Story 4 - Invited users receive role-aware first-login tutorial (Priority: P2)

**Goal**: Every invited user receives a first-login walkthrough filtered to modules/features allowed by their role and permissions.

**Independent Test**: Invite or use users with different roles, log in for the first time, confirm each sees only relevant modules, complete/dismiss tutorial, and verify later logins do not auto-show it.

### Implementation for User Story 4

- [x] T040 [US4] Extend tutorial module catalog role/permission metadata for `admin`, `teacher`, `bursar`, and `super_admin` in `backend/app/Services/TutorialService.php`
- [x] T041 [US4] Implement backend role/permission filtering so unauthorized modules are excluded from `GET /api/tutorial` in `backend/app/Services/TutorialService.php`
- [x] T042 [US4] Ensure invited users receive initial `not_started` tutorial progress on first tutorial fetch in `backend/app/Services/TutorialService.php`
- [x] T043 [US4] Ensure tutorial progress updates can only reference module keys visible to the authenticated user in `backend/app/Controllers/Api/TutorialController.php`
- [x] T044 [US4] Mount first-login tutorial for non-admin invited users in the authenticated application layout in `frontend/src/App.tsx`
- [x] T045 [US4] Hide setup-guide-only UI from non-admin invited users while preserving tutorial access in `frontend/src/components/onboarding/SetupGuideCard.tsx`
- [x] T046 [US4] Add role-aware empty/limited-access tutorial messaging in `frontend/src/components/tutorial/TutorialWalkthrough.tsx`
- [x] T047 [US4] Verify accepted invite login flow preserves tutorial eligibility after authentication in `frontend/src/pages/AcceptInvitePage.tsx`

**Checkpoint**: User Story 4 works independently for invited users and preserves backend-enforced access boundaries.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, documentation, and compliance checks across all user stories.

- [x] T048 [P] Run PHP lint for touched backend controllers, models, services, migration, and routes from `backend/`
- [x] T049 [P] Run frontend TypeScript check with `./node_modules/.bin/tsc --noEmit --pretty false` from `frontend/`
- [x] T050 [P] Run targeted ESLint for touched frontend files in `frontend/src/pages/OnboardingPage.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/hooks/useOnboarding.ts`, `frontend/src/hooks/useSetupGuide.ts`, `frontend/src/hooks/useTutorial.ts`, `frontend/src/components/onboarding/SetupGuideCard.tsx`, and `frontend/src/components/tutorial/TutorialWalkthrough.tsx`
- [x] T051 Apply database migration and verify new setup/tutorial tables using `backend/app/Database/Migrations/2026-05-18-000001_CreateOnboardingGuidanceTables.php`
- [x] T052 Execute quickstart curl validation for onboarding phone number and removal of fee-structure requirement using `specs/076-onboarding-guided-tutorial/quickstart.md`
- [ ] T053 Execute quickstart curl validation for setup guide order, skip rules, unauthorized guard, and tenant isolation using `specs/076-onboarding-guided-tutorial/quickstart.md`
- [ ] T054 Execute quickstart curl validation for admin tutorial and invited role-aware tutorial using `specs/076-onboarding-guided-tutorial/quickstart.md`
- [x] T055 Update quickstart validation results and deviations in `specs/076-onboarding-guided-tutorial/quickstart.md`
- [x] T056 Run repository whitespace check with `git diff --check` from repository root
- [x] T057 Review final implementation against all 11 constitution principles in `specs/076-onboarding-guided-tutorial/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; start immediately.
- **Phase 2 Foundational**: Depends on Phase 1 route/type/model/migration setup.
- **Phase 3 US1**: Depends on Phase 2 only; MVP scope.
- **Phase 4 US2**: Depends on Phase 2; pairs naturally after US1 because setup guide appears post-onboarding.
- **Phase 5 US3**: Depends on Phase 2; can be implemented after or alongside US2.
- **Phase 6 US4**: Depends on Phase 5 tutorial foundations and extends tutorial role filtering.
- **Phase 7 Polish**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 Complete streamlined school onboarding (P1)**: Can start after Foundational; no dependency on other stories.
- **US2 Follow recommended setup flow (P1)**: Can start after Foundational; useful after US1 for full post-onboarding demo.
- **US3 Learn modules through admin walkthrough (P2)**: Can start after Foundational; independent of setup guide UI.
- **US4 Invited users role-aware tutorial (P2)**: Depends on tutorial service/UI built in US3, but remains independently testable for invited users.

### Within Each User Story

- Backend model/service logic before controller response wiring.
- Controller/API methods before frontend hooks that consume them.
- Hooks/API types before page/component integration.
- Story checkpoint validation before moving to the next priority when working sequentially.

---

## Parallel Opportunities

- **Setup**: T002, T003, and T004 can run in parallel after T001 is understood.
- **Foundational**: T011, T012, T013, and T014 can run in parallel with backend service/controller work once API shapes are agreed.
- **US1**: T015-T018 backend work and T019-T023 frontend work can proceed in parallel with coordination on response shape.
- **US2**: T024-T027 backend work and T028-T031 frontend work can proceed in parallel after foundational API types exist.
- **US3**: T032-T035 backend tutorial work and T036-T039 frontend walkthrough work can proceed in parallel after tutorial contract is stable.
- **US4**: T040-T043 backend role filtering and T044-T047 frontend invited-user integration can proceed in parallel.
- **Polish**: T048-T050 can run in parallel; T052-T054 can run as separate curl validation tracks after implementation is complete.

---

## Parallel Example: User Story 1

```bash
Task: "Remove fee-structure from onboarding STEPS and REQUIRED_STEPS in backend/app/Models/OnboardingProgressModel.php"
Task: "Remove fee-structure from frontend onboarding step order and labels in frontend/src/hooks/useOnboarding.ts"
Task: "Add phone number field and validation to frontend/src/components/onboarding/StepAdminProfile.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Implement setup guide retrieval in backend/app/Services/SetupGuideService.php"
Task: "Render ordered setup guide steps in frontend/src/components/onboarding/SetupGuideCard.tsx"
Task: "Ensure setup guide query invalidation in frontend/src/hooks/useSetupGuide.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Define administrator-visible tutorial module catalog in backend/app/Services/TutorialService.php"
Task: "Render tutorial controls in frontend/src/components/tutorial/TutorialWalkthrough.tsx"
Task: "Mount admin tutorial walkthrough in frontend/src/pages/Dashboard.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "Implement backend role/permission filtering in backend/app/Services/TutorialService.php"
Task: "Mount first-login tutorial for invited users in frontend/src/App.tsx"
Task: "Verify accepted invite login flow in frontend/src/pages/AcceptInvitePage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational service/API/hook shell.
3. Complete Phase 3: User Story 1.
4. Stop and validate onboarding independently: no fee-structure step, phone number accepted, onboarding completes.
5. Demo or deploy MVP if only onboarding streamlining is required.

### Recommended Incremental Delivery

1. Complete Setup + Foundational.
2. Deliver US1 to unblock simpler onboarding.
3. Deliver US2 to guide admins through post-onboarding operational setup.
4. Deliver US3 to orient administrators through modules.
5. Deliver US4 to support invited users with role-aware tutorials.
6. Run Phase 7 validation and update quickstart results.

### Validation Strategy

- Run code-level checks before curl validation.
- Run curl validation only after feature implementation is complete, per Constitution Principle X.
- Validate tenant isolation and role filtering before considering the feature complete.

---

## Summary

- **Total tasks**: 57
- **Setup tasks**: 5
- **Foundational tasks**: 9
- **US1 tasks**: 9
- **US2 tasks**: 8
- **US3 tasks**: 8
- **US4 tasks**: 8
- **Polish tasks**: 10
- **MVP scope**: Phase 1 + Phase 2 + User Story 1 (T001-T023)
