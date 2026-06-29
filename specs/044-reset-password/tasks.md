# Tasks: Reset Password

**Input**: Design documents from `/specs/044-reset-password/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Minimal - Adding to Existing Project)

**Purpose**: Environment configuration for password reset feature

- [ ] T001 [P] Add password reset environment variables to `backend/.env.example`
- [ ] T002 [P] Update TypeScript types in `frontend/src/types/auth.ts` (add ForgotPasswordRequest, ResetPasswordRequest)
- [ ] T003 [P] Add Zod validation schemas to `frontend/src/validation/auth.ts` (forgotPasswordSchema, resetPasswordSchema)

**Checkpoint**: Environment and shared types ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Backend Foundation

- [ ] T004 Create migration file `backend/app/Database/Migrations/2026-04-27-CreatePasswordResetTokensTable.php`
- [ ] T005 Run migration: `cd backend && php spark migrate`
- [ ] T006 [P] Create model `backend/app/Models/PasswordResetTokenModel.php` (extends CodeIgniter Model)
- [ ] T007 Add password reset routes to `backend/app/Config/Routes.php` (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password/(:any)`)
- [ ] T008 [P] Configure email settings in `backend/.env` for reset emails (if not already configured)

### Frontend Foundation

- [ ] T009 [P] Add password reset API methods to `frontend/src/api/auth.ts` (forgotPassword, resetPassword)
- [ ] T010 Create custom hook `frontend/src/hooks/usePasswordReset.ts` (useForgotPassword, useResetPassword mutations)

**Checkpoint**: Foundation ready - database table exists, routes registered, API layer ready

---

## Phase 3: User Story 1 - Request Password Reset (Priority: P1) 🎯 MVP

**Goal**: Users can see "Forgot Password?" link on login page and submit email to request reset

**Independent Test**: Navigate to login page → see "Forgot Password?" link → click → see email form → submit → receive generic success message

### Tests for User Story 1

- [ ] T011 [P] [US1] Integration test: Forgot password link visibility on login page (`frontend/tests/integration/forgot-password-link.spec.ts`)
- [ ] T012 [P] [US1] Contract test: POST /api/auth/forgot-password endpoint (`backend/tests/integration/ForgotPasswordEndpointTest.php`)

### Implementation for User Story 1

#### Frontend - Login Page Enhancement
- [ ] T013 [US1] Add "Forgot Password?" link to `frontend/src/pages/LoginPage.tsx` (position near login form)
- [ ] T014 [P] [US1] Create `frontend/src/components/auth/ForgotPasswordForm.tsx` (email input, validation, submit)
- [ ] T015 [US1] Create `frontend/src/pages/ForgotPasswordPage.tsx` (page wrapper, routing, success/error states)
- [ ] T016 [US1] Add forgot password route to `frontend/src/App.tsx` or router config (`/forgot-password`)

#### Backend - Forgot Password Endpoint
- [ ] T017 [US1] Add `forgotPassword()` method to `backend/app/Controllers/AuthController.php`
- [ ] T018 [P] [US1] Create `backend/app/Services/PasswordResetService.php` with `generateToken()` method
- [ ] T019 [US1] Implement email validation and rate limiting in forgotPassword controller
- [ ] T020 [US1] Implement token generation logic (256-bit random, SHA-256 hash, 24h expiry)
- [ ] T021 [US1] Create email template view `backend/app/Views/emails/password_reset.php` (HTML + plain text)
- [ ] T022 [US1] Add email sending logic using CodeIgniter Email class
- [ ] T023 [US1] Add security logging for password reset requests

**Checkpoint**: User Story 1 complete - login page has forgot password link, form submits, email validation works, generic success message shown

---

## Phase 4: User Story 2 - Receive and Use Reset Token (Priority: P2)

**Goal**: Users receive reset email with secure link and can access password reset form via valid token

**Independent Test**: Submit forgot password request → check email for reset link → click link → land on reset form (if token valid) or error page (if invalid/expired)

### Tests for User Story 2

- [ ] T024 [P] [US2] Integration test: Reset email delivery and content validation (`backend/tests/integration/ResetEmailTest.php`)
- [ ] T025 [P] [US2] Contract test: Token validation endpoint behavior (`backend/tests/integration/TokenValidationTest.php`)

### Implementation for User Story 2

#### Frontend - Reset Password Page
- [ ] T026 [US2] Create `frontend/src/pages/ResetPasswordPage.tsx` (extracts token from URL, validates, renders form or error)
- [ ] T027 [US2] Add reset password route to router config (`/reset-password/:token`)
- [ ] T028 [P] [US2] Create `frontend/src/components/auth/ResetPasswordForm.tsx` (password inputs, validation, submit)

#### Backend - Token Validation
- [ ] T029 [US2] Add token validation method to `backend/app/Services/PasswordResetService.php` (`validateToken()`)
- [ ] T030 [US2] Implement token hash lookup in `PasswordResetTokenModel` (find by hash, check expiry, check used_at)
- [ ] T031 [US2] Handle edge cases: expired tokens, used tokens, non-existent tokens (appropriate error messages)

**Checkpoint**: User Story 2 complete - emails sent with valid links, token validation works, reset form accessible

---

## Phase 5: User Story 3 - Set New Password (Priority: P3)

**Goal**: Users can submit new password via reset form, password is updated, tokens are invalidated

**Independent Test**: Access valid reset token URL → enter matching passwords → submit → see success message → login with new password works, old password fails

### Tests for User Story 3

- [ ] T032 [P] [US3] Integration test: Password reset completion flow (`backend/tests/integration/PasswordResetCompletionTest.php`)
- [ ] T033 [P] [US3] Integration test: Password complexity validation (`backend/tests/integration/PasswordValidationTest.php`)

### Implementation for User Story 3

#### Backend - Password Update
- [ ] T034 [US3] Add `resetPassword()` method to `backend/app/Controllers/AuthController.php`
- [ ] T035 [US3] Add `updatePassword()` method to `backend/app/Services/PasswordResetService.php`
- [ ] T036 [P] [US3] Implement password validation (complexity requirements, matching confirmation)
- [ ] T037 [US3] Update user password hash in database using `password_hash()` (PASSWORD_BCRYPT)
- [ ] T038 [US3] Mark token as used (set `used_at` timestamp)
- [ ] T039 [US3] Invalidate all other unused tokens for this user
- [ ] T040 [US3] Add success response and security logging for password reset completion

#### Frontend - Form Submission
- [ ] T041 [US3] Wire up `ResetPasswordForm` to `useResetPassword` hook
- [ ] T042 [US3] Add success state handling with redirect to login page
- [ ] T043 [US3] Add error state handling (invalid token, password validation errors)

**Checkpoint**: User Story 3 complete - password updates work, old passwords invalid, all tokens properly managed

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T044 [P] Add rate limiting middleware to `backend/app/Config/Filters.php` (3 per email/hour, 10 per IP/hour)
- [ ] T045 Implement rate limiting logic in `backend/app/Filters/PasswordResetRateLimitFilter.php`
- [ ] T046 [P] Add error boundary for reset pages in `frontend/src/components/ErrorBoundary.tsx`
- [ ] T047 [P] Update quickstart.md with any deviations discovered during implementation
- [ ] T048 [P] Add loading states to forms (shadcn/ui Skeleton components)
- [ ] T049 [P] Add accessibility attributes (ARIA labels, focus management) to auth forms
- [ ] T050 Security review: Verify all tokens use cryptographically secure random generation
- [ ] T051 Run full integration test suite: `cd backend && php vendor/bin/phpunit tests/integration/PasswordReset*`
- [ ] T052 Run E2E tests: `cd frontend && npx playwright test specs/password-reset.spec.ts`
- [ ] T053 Update `CLAUDE.md` if new patterns discovered

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1's email form, but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but independently testable

**Note**: US2 and US3 have logical dependencies on previous stories (need email form to send reset, need token validation to set password), but can be developed in parallel if mocked interfaces are used.

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Frontend components before page integration
- Backend service methods before controller endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Frontend and backend work within a story can often proceed in parallel (with mocked interfaces)
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "T011 [P] [US1] Integration test: Forgot password link visibility"
Task: "T012 [P] [US1] Contract test: POST /api/auth/forgot-password endpoint"

# Launch frontend and backend models in parallel:
Task: "T014 [P] [US1] Create ForgotPasswordForm.tsx"
Task: "T006 [P] [US1] Create PasswordResetTokenModel.php"

# Service and controller after model ready:
Task: "T018 [P] [US1] Create PasswordResetService.php"
Task: "T017 [US1] Add forgotPassword() method to AuthController.php"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Verify login page shows "Forgot Password?" link
   - Verify clicking link navigates to forgot password form
   - Verify form submits and shows generic success message
   - Verify email validation works
   - Verify rate limiting works
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
   - Verify reset emails sent
   - Verify email contains valid reset link
   - Verify clicking valid link opens reset form
   - Verify invalid/expired tokens show error
4. Add User Story 3 → Test independently → Deploy/Demo
   - Verify password update works
   - Verify new password works for login
   - Verify old password rejected
   - Verify tokens invalidated after use
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (frontend focus)
   - Developer B: User Story 2 (backend/email focus)
   - Developer C: User Story 3 (backend/validation focus)
3. Or:
   - Developer A: All frontend work (US1-US3)
   - Developer B: All backend work (US1-US3)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | T001-T003 | Environment config, types, validation schemas |
| Phase 2: Foundational | T004-T010 | Migration, model, routes, API methods, hooks |
| Phase 3: US1 (P1) | T011-T023 | Forgot password link, form, endpoint, email |
| Phase 4: US2 (P2) | T024-T031 | Reset email, token validation, reset page |
| Phase 5: US3 (P3) | T032-T043 | Password update, token invalidation, completion |
| Phase 6: Polish | T044-T053 | Rate limiting, accessibility, testing, docs |

**Total Tasks**: 53
**MVP Tasks (through US1)**: 23
