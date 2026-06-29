# Tasks: School Creation & Admin Onboarding

**Input**: Design documents from `/specs/043-school-creation-onboarding/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Organization**: Tasks grouped by user story (P1 → P4) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: User story this task belongs to (US1–US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch confirmation and directory scaffolding — must complete before any coding starts.

- [ ] T001 Confirm active branch is `043-school-creation-onboarding` (`git status`)
- [ ] T002 [P] Create `backend/app/Services/SchoolProvisioningService.php` as empty class stub
- [ ] T003 [P] Create `backend/app/Controllers/Api/OnboardingController.php` as empty class stub
- [ ] T004 [P] Create `backend/app/Models/OnboardingProgressModel.php` as empty class stub
- [ ] T005 [P] Create `backend/tests/Feature/SchoolProvisioningTest.php` as empty test class stub
- [ ] T006 [P] Create `frontend/src/pages/OnboardingPage.tsx` as empty component stub
- [ ] T007 [P] Create `frontend/src/hooks/useOnboarding.ts` as empty hooks stub
- [ ] T008 [P] Create `frontend/src/components/onboarding/` directory with six empty step component stubs: `StepPasswordChange.tsx`, `StepAdminProfile.tsx`, `StepContactDetails.tsx`, `StepWorkHours.tsx`, `StepAcademicCalendar.tsx`, `StepFeeStructure.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database migrations and core service — MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: All three migrations must be applied and `SchoolProvisioningService` complete before US1–US4 work begins.

- [ ] T009 Write migration `backend/app/Database/Migrations/2026-04-27-100000_Add_pending_status_to_tenants.php` — ALTER `tenants.status` ENUM to add `'pending'`; `down()` removes it. (See data-model.md §Schema Changes)
- [ ] T010 Write migration `backend/app/Database/Migrations/2026-04-27-100001_Add_credential_flags_to_users.php` — ADD `is_temp_password TINYINT(1) DEFAULT 0` and `onboarding_complete TINYINT(1) DEFAULT 0` to `users`; `down()` drops both columns. (See data-model.md §users)
- [ ] T011 Write migration `backend/app/Database/Migrations/2026-04-27-100002_Create_onboarding_progress_table.php` — CREATE TABLE `onboarding_progress` with columns `id`, `user_id` (UNIQUE FK→users), `tenant_id` (FK→tenants), `current_step VARCHAR(50) DEFAULT 'password'`, `completed_steps JSON DEFAULT '[]'`, `step_data JSON NULL`, `created_at`, `updated_at`; indexes on `user_id` (UNIQUE) and `tenant_id`; `down()` drops table. (See data-model.md §onboarding_progress)
- [ ] T012 Run `php spark migrate` in `backend/` and verify all three new migrations apply cleanly
- [ ] T013 Implement `backend/app/Services/SchoolProvisioningService.php` with three public methods: `provision(string $name, string $email): array` (creates tenant + user, sends email, returns tenant data), `activateTenant(string $tenantId, string $userId): array` (sets tenant `status='trialing'`, enrolls trial subscription, sets `onboarding_complete=1`), and `resendWelcome(string $tenantId): void` (re-sends welcome email to the tenant's admin). Use `bin2hex(random_bytes(12))` for temp password, `password_hash(..., PASSWORD_BCRYPT, ['cost'=>12])` for hashing, query `subscription_plans WHERE max_students IS NULL AND is_active=1 LIMIT 1` for trial plan, wrap email send in try/catch and set `email_sent` flag. All DB writes use transactions. (See research.md §1, §5, §8)
- [ ] T014 Write integration test `backend/tests/Feature/SchoolProvisioningTest.php` covering: `testCreateSchoolSuccess`, `testCreateSchoolDuplicateEmail` (expects 409), `testCreateSchoolBlankName` (expects 422), `testActivateTenantCreatesTrialSubscription`, `testResendWelcomeThrowsIfAlreadyActive`. (See quickstart.md §Running Integration Tests)

**Checkpoint**: Run `composer test -- --filter SchoolProvisioningTest`. Migrations applied. Service tested. ✅

---

## Phase 3: User Story 1 — Platform User Creates a New School (Priority: P1) 🎯 MVP

**Goal**: Super-admin can submit school name + email → tenant provisioned in `pending` state → admin account created → welcome email dispatched.

**Independent Test**: `POST /api/platform/tenants` with valid payload returns 201, tenant row exists with `status='pending'`, user row exists with `is_temp_password=1`, email log shows welcome sent.

### Implementation

- [ ] T015 [US1] Extend `backend/app/Controllers/Platform/TenantsController.php` `store()` method: remove the `subdomain` required-field check; auto-generate subdomain from school name using `strtolower(preg_replace('/[^a-z0-9]+/', '-', $name))` with uniqueness loop (`-2`, `-3`, etc.); delegate creation to `SchoolProvisioningService::provision()`; return 201 with `email_sent` flag; surface email-failure message when `email_sent=false`. (See contracts/platform-school-creation.md §POST /api/platform/tenants)
- [ ] T016 [US1] Add `POST /api/platform/tenants/:id/resend-welcome` route to `backend/app/Config/Routes.php` and implement `TenantsController::resendWelcome($id)` method: verify tenant exists, verify `status='pending'` (409 if already active), call `SchoolProvisioningService::resendWelcome()`, return 200. (See contracts/platform-school-creation.md §POST …/resend-welcome)
- [ ] T017 [US1] Update `backend/app/Controllers/Api/AuthController.php` `login()`: after successful authentication, query `users.is_temp_password` and `users.onboarding_complete`; include both as booleans in the `user` response object and in the JWT payload under `isTempPassword` and `onboardingComplete`. Also block login when `tenants.status = 'pending'` with message "Your school setup is not yet complete. Please check your email for login instructions." (See contracts/school-onboarding.md §Auth: POST /api/auth/login, research.md §7)
- [ ] T018 [US1] Update `frontend/src/admin/pages/Schools.tsx`: change "Create School" modal to accept only `name` and `email` fields (remove subdomain input); update the `createTenant` API call in `frontend/src/api/api.ts` to send `{ name, email }` only; surface the `email_sent: false` warning banner when present in the response. (See contracts/platform-school-creation.md)
- [ ] T019 [US1] Add `resendWelcome(tenantId: string)` API function to `frontend/src/api/api.ts` and wire a "Resend Welcome Email" action button on the Schools list for tenants with `status='pending'`. (See contracts/platform-school-creation.md §resend-welcome)

**Checkpoint**: Create a school via the platform UI. Verify tenant row `status='pending'`, user row `is_temp_password=1`. Attempt login with generated credentials — confirm redirect to `/onboarding` (implemented in US2/US3). ✅

---

## Phase 4: User Story 2 — Admin Receives Credentials and Logs In (Priority: P2)

**Goal**: Admin can log in with the temporary password from the welcome email. First login detects the credential state and flags the session for onboarding routing.

**Independent Test**: Use temp credentials from the provisioned user to call `POST /api/auth/login` — response includes `is_temp_password: true`, `onboarding_complete: false`, valid JWT. Re-using same credentials after first login returns `is_temp_password: false` (credential invalidated).

### Implementation

- [ ] T020 [US2] Update `backend/app/Controllers/Api/AuthController.php` `login()`: on successful authentication where `is_temp_password=1`, set `is_temp_password=0` on the user record immediately (invalidate on first use); the updated flag value is reflected in the response. Ensure timing-safe comparison is preserved (already in `UserModel::authenticate()`). (See research.md §2)
- [ ] T021 [US2] Update `frontend/src/contexts/AuthContext.tsx`: extend the stored `user` type to include `is_temp_password: boolean` and `onboarding_complete: boolean`; parse these fields from the login response and store in context state.
- [ ] T022 [US2] Update `frontend/src/App.tsx`: add a `<ProtectedRoute>` guard — for any user with `role='admin'` and `onboarding_complete=false`, redirect to `/onboarding` regardless of the requested route (including direct URL navigation). Register the `/onboarding` route pointing to `frontend/src/pages/OnboardingPage.tsx`. (See research.md §7, §9)

**Checkpoint**: Log in as provisioned admin → `is_temp_password` in response is `true` first time, `false` on second login. Frontend redirects to `/onboarding`. Direct URL to `/dashboard` also redirects to `/onboarding`. ✅

---

## Phase 5: User Story 3 — Admin Completes Personalized Onboarding Setup (Priority: P3)

**Goal**: Admin navigates a 6-step wizard (password change prompt → admin profile → contact details → work hours → academic calendar → fee structure). School name and email are pre-filled and read-only. Progress saves per step; wizard resumes after browser close. Completion activates the school and redirects to dashboard.

**Independent Test**: Navigate all steps as a provisioned admin, submit each step, call `POST /api/onboarding/complete` — tenant `status` becomes `'trialing'`, `onboarding_complete=1` on user row, wizard redirects to `/dashboard`.

### Implementation — Backend

- [ ] T023 [US3] Implement `backend/app/Models/OnboardingProgressModel.php`: table `onboarding_progress`, `allowedFields` = `['user_id','tenant_id','current_step','completed_steps','step_data']`, method `getForUser(string $userId): ?array`, method `upsertProgress(string $userId, string $tenantId, string $step, array $completedSteps, ?array $stepData): void` (INSERT on first call, UPDATE thereafter using `user_id` unique constraint). (See data-model.md §onboarding_progress)
- [ ] T024 [US3] Implement `backend/app/Controllers/Api/OnboardingController.php` with four methods:
  - `getProgress()` — GET /api/onboarding/progress: fetch `onboarding_progress` row for authenticated user; include pre-filled `school_name` from `tenants.name` and `admin_email` from `users.email`; return 200 with progress object. (See contracts/school-onboarding.md §GET)
  - `saveProgress()` — POST /api/onboarding/progress: validate `step` and `data` per step schema (see data-model.md §Validation Rules); call `OnboardingProgressModel::upsertProgress()`; return 200. (See contracts/school-onboarding.md §POST progress)
  - `complete()` — POST /api/onboarding/complete: verify all mandatory steps (`profile`, `contact`, `work-hours`, `academic-calendar`, `fee-structure`) present in `completed_steps`; if any missing return 422 with `missing_steps`; else call `SchoolProvisioningService::activateTenant()`; return 200 with subscription details. (See contracts/school-onboarding.md §POST complete)
  - `changePassword()` — POST /api/onboarding/change-password: validate `new_password` (min 8 chars) and `confirm_password` match; `password_hash` the new password; update `users.password`; return 200 with `is_temp_password: false`. (See contracts/school-onboarding.md §POST change-password)
- [ ] T025 [US3] Register onboarding routes in `backend/app/Config/Routes.php` under `JWTAuthFilter`:
  - `GET  api/onboarding/progress` → `OnboardingController::getProgress`
  - `POST api/onboarding/progress` → `OnboardingController::saveProgress`
  - `POST api/onboarding/complete` → `OnboardingController::complete`
  - `POST api/onboarding/change-password` → `OnboardingController::changePassword`

### Implementation — Frontend

- [ ] T026 [P] [US3] Implement `frontend/src/hooks/useOnboarding.ts`: export `useOnboardingProgress()` (React Query `useQuery` for GET /api/onboarding/progress), `useSaveStep()` (React Query `useMutation` for POST /api/onboarding/progress), `useCompleteOnboarding()` (mutation for POST /api/onboarding/complete), `useChangePassword()` (mutation for POST /api/onboarding/change-password). Add all four API call functions to `frontend/src/api/api.ts`. (See contracts/school-onboarding.md)
- [ ] T027 [P] [US3] Implement `frontend/src/components/onboarding/StepPasswordChange.tsx`: optional step; shows new-password and confirm-password fields validated with React Hook Form + Zod (min 8 chars, passwords match); skip button advances to next step without calling API; submit calls `useChangePassword()`. (See spec.md US3 acceptance scenario 1–2)
- [ ] T028 [P] [US3] Implement `frontend/src/components/onboarding/StepAdminProfile.tsx`: required field `admin_name` (2–100 chars); validates with Zod; submit calls `useSaveStep({ step: 'profile', data: { admin_name } })`. (See data-model.md §Validation Rules)
- [ ] T029 [P] [US3] Implement `frontend/src/components/onboarding/StepContactDetails.tsx`: required fields `contact_email` (valid email) and `address` (5–500 chars); validates with Zod; submit calls `useSaveStep({ step: 'contact', ... })`.
- [ ] T030 [P] [US3] Implement `frontend/src/components/onboarding/StepWorkHours.tsx`: required `staff_work_hours` and `student_work_hours` objects each with `startTime` and `endTime` (HH:MM, start < end); validates with Zod; submit calls `useSaveStep({ step: 'work-hours', ... })`.
- [ ] T031 [P] [US3] Implement `frontend/src/components/onboarding/StepAcademicCalendar.tsx`: requires at least one term entry with `name`, `startDate`, `endDate` (start < end); `schoolOpen` boolean toggle; validates with Zod; submit calls `useSaveStep({ step: 'academic-calendar', ... })`.
- [ ] T032 [P] [US3] Implement `frontend/src/components/onboarding/StepFeeStructure.tsx`: requires at least one fee entry with `name` and `amount > 0`; validates with Zod; submit calls `useSaveStep({ step: 'fee-structure', ... })`.
- [ ] T033 [US3] Implement `frontend/src/pages/OnboardingPage.tsx`: multi-step wizard shell; loads progress via `useOnboardingProgress()`; resumes from `current_step` on mount; renders the correct step component; shows step progress indicator; school name and admin email displayed as read-only pre-filled banner at top of wizard; final step calls `useCompleteOnboarding()` on submit; on success updates `AuthContext` `onboarding_complete=true` and navigates to `/dashboard`. (See spec.md US3, research.md §7)

**Checkpoint**: Log in as provisioned admin → wizard opens at correct step. Fill all steps → call complete → check `tenants.status='trialing'` and `users.onboarding_complete=1`. Dashboard loads. ✅

---

## Phase 6: User Story 4 — School Activated with Free Trial Enrollment (Priority: P4)

**Goal**: `SchoolProvisioningService::activateTenant()` atomically sets tenant `status='trialing'`, inserts `school_subscriptions` row with unlimited plan, `starts_at=NOW()`, `expires_at=DATE_ADD(NOW(), INTERVAL 3 MONTH)`, `amount_paid_cents=0`. Dashboard surfaces trial info.

**Independent Test**: After `POST /api/onboarding/complete`, query DB — one `school_subscriptions` row with `status='active'`, `plan_id` of the unlimited plan, `expires_at` ≈ 3 months from now. Dashboard shows trial badge with correct end date.

### Implementation

- [ ] T034 [US4] Verify `SchoolProvisioningService::activateTenant()` (implemented in T013) correctly queries `subscription_plans WHERE max_students IS NULL AND is_active=1 LIMIT 1`; throws `\RuntimeException` with message "Trial plan unavailable" if no plan found (tenant stays `pending`, error surfaced via 500 response in `OnboardingController::complete()`); inserts `school_subscriptions` row with all required fields; wraps both the tenant update and subscription insert in a single DB transaction. (See research.md §5, §10; data-model.md §school_subscriptions)
- [ ] T035 [US4] Add integration test cases to `backend/tests/Feature/SchoolProvisioningTest.php`: `testTrialEnrollmentSetsCorrectExpiry` (assert `expires_at` is within 1 day of 3 months from now), `testTrialEnrollmentUsesUnlimitedPlan` (assert `max_students IS NULL` on joined plan), `testActivationIsAtomicOnPlanMissing` (assert tenant stays `pending` if no unlimited plan exists). (See quickstart.md §Verify the Unlimited Trial Plan Exists)
- [ ] T036 [US4] Update `frontend/src/api/api.ts` to include the subscription fields (`plan_name`, `status`, `starts_at`, `expires_at`) returned by `POST /api/onboarding/complete` in the TypeScript response type.
- [ ] T037 [US4] Add a trial status banner component to the main dashboard layout (identify the dashboard layout wrapper in `frontend/src/App.tsx` or `frontend/src/pages/`): if the logged-in admin's tenant has `status='trialing'`, display trial end date and package name ("Unlimited") using data from `GET /api/tenants/current` or from the `onboarding/complete` response stored in context. (See spec.md US4 acceptance scenario 2; contracts/school-onboarding.md §POST complete)

**Checkpoint**: Complete onboarding → DB row in `school_subscriptions` verified → dashboard shows trial badge with correct expiry date. Integration tests pass. ✅

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, audit logging, and final validation across all stories.

- [ ] T038 [P] Add `AuditService::logFromRequest('platform.tenant.provision', ...)` call inside `SchoolProvisioningService::provision()` in `backend/app/Services/SchoolProvisioningService.php` — log `tenant_id`, `admin_email`, `email_sent` flag.
- [ ] T039 [P] Add `AuditService::logFromRequest('tenant.onboarding.complete', ...)` call inside `SchoolProvisioningService::activateTenant()` — log `tenant_id`, `plan_id`, `expires_at`.
- [ ] T040 [P] Ensure all four `OnboardingController` methods log errors at `log_message('error', ...)` level with `tenant_id` and `user_id` context before returning `respondError` responses, per Principle IX. File: `backend/app/Controllers/Api/OnboardingController.php`.
- [ ] T041 [P] Update `frontend/src/types/` (or relevant TypeScript type file) to add `is_temp_password: boolean` and `onboarding_complete: boolean` to the `User` interface, ensuring type safety across all components that consume `AuthContext`.
- [ ] T042 Run `composer test` in `backend/` — all tests pass including `SchoolProvisioningTest`.
- [ ] T043 Run `npm run lint` in `frontend/` — zero ESLint errors in all new/modified files.
- [ ] T044 Manually execute the full quickstart.md flow end-to-end: create school → login → complete wizard → verify trial → access dashboard. Confirm 0% dashboard bypass (SC-008) by attempting direct URL navigation to `/dashboard` as an admin with `onboarding_complete=false`.
- [ ] T045 Update `CLAUDE.md` `## Recent Changes` section to document this feature: new `SchoolProvisioningService`, `OnboardingController`, three new migrations, `onboarding_progress` table, frontend `/onboarding` wizard.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 (migrations + service)
- **US2 (Phase 4)**: Depends on Phase 2 + T017 (login response extension)
- **US3 (Phase 5)**: Depends on Phase 2 + T020 (credential invalidation) + T022 (route guard)
- **US4 (Phase 6)**: Depends on T013 (`activateTenant` in service) + T024 (`complete()` controller method)
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

| Story | Depends on | Can parallelise with |
|-------|-----------|---------------------|
| US1 (P1) | Phase 2 complete | — |
| US2 (P2) | Phase 2 + T017 | US1 backend work |
| US3 (P3) | Phase 2 + T020 + T022 | Backend (T023–T025) ∥ Frontend (T026–T032) |
| US4 (P4) | T013 (activateTenant) + T024 (complete controller) | T035–T037 can run in parallel |

### Within Each Story

- Migrations → Service → Controller → Routes → Frontend hooks → Frontend components → Page assembly
- Backend tasks for a story can run in parallel with unrelated frontend tasks for the same story (marked `[P]`)

---

## Parallel Execution Examples

### Phase 2 — Foundational

```
T009 ∥ T010 ∥ T011   (three independent migrations, different files)
T013 → (after T012 migrate confirmed)
T014 → (after T013 service complete)
```

### Phase 5 — US3 Frontend Steps

```
T027 ∥ T028 ∥ T029 ∥ T030 ∥ T031 ∥ T032   (six independent step components)
T026 ∥ T023   (hooks + model — different stacks)
T033 → (after all step components + hooks complete)
```

### Phase 7 — Polish

```
T038 ∥ T039 ∥ T040 ∥ T041   (all different files, no dependencies)
T042 → T043 → T044 → T045   (sequential validation)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (migrations + service + tests)
3. Phase 3: US1 (platform creates school, welcome email sent)
4. **STOP & VALIDATE**: Verify tenant provisioned, email delivered, platform UI updated
5. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → platform can provision schools ✅ demo-able
3. US2 → admin can log in with temp credentials ✅ demo-able
4. US3 → admin completes wizard, school activated ✅ demo-able
5. US4 → trial enrolled, dashboard shows trial badge ✅ feature complete
6. Polish → hardened, audited, documented

---

## Notes

- `[P]` = different files, no unresolved dependencies — safe to implement in parallel
- `[Story]` label maps every task to its user story for traceability
- The six wizard step components (T027–T032) are fully independent — assign to multiple developers or implement in one session with parallel context windows
- Commit after each checkpoint to preserve a verified working state
- Do not edit existing migration files — always create new ones (Principle IV)
- All new queries must include `tenant_id` from JWT (Principle I) — applies especially to `OnboardingController`
