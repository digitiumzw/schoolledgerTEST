# Tasks: Invitation-Based User Onboarding

**Input**: Design documents from `/specs/045-invite-user-onboarding/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/invite-api.md ✅ · quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths are included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations and shared service scaffolding that every user story depends on.

- [X] T001 Create migration `backend/app/Database/Migrations/2026-04-27-320000_Create_user_invitations_table.php` — `user_invitations` table with all columns, indexes, and `down()` as specified in data-model.md
- [X] T002 Create migration `backend/app/Database/Migrations/2026-04-27-330000_Add_invited_status_to_users.php` — ALTER `users.status` ENUM to add `'invited'`; `down()` reverts with UPDATE + ALTER
- [X] T003 Create `backend/app/Models/UserInvitationModel.php` — CodeIgniter Model for `user_invitations` table; `$allowedFields`, `$useTimestamps = false` (manual `created_at`); helper method `findActiveByTokenHash(string $hash): ?array`
- [X] T004 Create `backend/app/Services/InvitationService.php` — service class with methods: `issue(string $tenantId, string $invitedBy, array $userData): array` (generates token, inserts invitation row, dispatches email, returns `[$plainToken, $invitationRow]`); `invalidatePending(string $email, string $tenantId): void`; `accept(string $plainToken, string $password): bool`; `resend(string $userId, string $tenantId, string $invitedBy): void` — all token generation uses `bin2hex(random_bytes(32))` hashed via `hash('sha256', ...)`; expiry = `NOW() + 48h`
- [X] T005 Create email template `backend/app/Views/emails/user_invitation.php` — HTML email matching existing template style (`password_reset.php`); variables: `$recipient_name`, `$recipient_email`, `$invite_link`, `$app_url`, `$logo_url`; body explains this is an invitation to join the school's SchoolLedger account; CTA button "Accept Invitation & Set Password"; expiry note: "This link expires in 48 hours"
- [X] T006 Add `sendInvitation(string $to, string $recipientName, string $recipientEmail, string $inviteLink): void` method to `backend/app/Services/EmailService.php`

**Checkpoint**: Migrations, model, service skeleton, and email template ready. Run `php spark migrate` to verify no errors before proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend auth and user controller changes that gate all user-facing stories.

- [X] T007 Modify `backend/app/Controllers/Api/AuthController.php` — in `login()`, after fetching the user record, add explicit check: if `$user['status'] === 'invited'` return `$this->error('Your account is pending. Please accept your invitation email to set a password.', 403)`
- [X] T008 Add public path exemption for `accept-invite` in `backend/app/Filters/JWTAuthFilter.php` — add `'api/auth/accept-invite'` to the `$publicPaths` array (same pattern as `forgot-password` and `reset-password`)
- [X] T009 [P] Add route for `POST api/auth/accept-invite` in `backend/app/Config/Routes.php` — inside the `api/auth` group: `$routes->post('accept-invite', 'AuthController::acceptInvite');`
- [X] T010 [P] Add routes for invite and resend in `backend/app/Config/Routes.php` — inside the `api/users` group (or equivalent): `$routes->post('invite', 'UserController::invite');` and `$routes->post('(:segment)/resend-invite', 'UserController::resendInvite/$1');`

**Checkpoint**: Auth login correctly rejects `invited` accounts; public route exemption in place; routes registered. Foundation ready for all user stories.

---

## Phase 3: User Story 1 — Admin Invites a New User (Priority: P1) 🎯 MVP

**Goal**: Admin fills name/email/role and clicks "Invite" — backend creates `pending` user and sends invitation email.

**Independent Test**: `POST /api/users/invite` with valid admin JWT creates a user with `status='invited'`, inserts a row in `user_invitations`, and (in test env) confirms email dispatch attempted.

### Implementation

- [X] T011 [US1] Modify `backend/app/Controllers/Api/UserController.php` — replace `create()` method body with `invite()` logic: validate `name`, `email`, `role` (no `password` field); enforce role-based restrictions and the 5-account cap against `status IN ('active','invited')`; check email uniqueness per tenant; call `InvitationService::issue()`; insert user with `status='invited'`, `password=NULL`; return `201` response with user payload (no password data)
- [X] T012 [US1] Add `AuthController::acceptInvite()` stub in `backend/app/Controllers/Api/AuthController.php` — stub that returns `501 Not Implemented` (will be completed in US2/T018); ensures the public route resolves without 404
- [X] T013 [US1] Complete `InvitationService::issue()` in `backend/app/Services/InvitationService.php` — wire in `UserInvitationModel` insert, call `EmailService::sendInvitation()` (wrap in try/catch; log failure; do not throw), audit-log `user.invite` via `AuditService::log()`
- [X] T014 [P] [US1] Modify `frontend/src/api/api.ts` — add `inviteUser(payload: { name: string; email: string; role: string }): Promise<User>` method calling `POST /users/invite`; remove `createUser` (with password) and `resetUserPassword` methods
- [X] T015 [P] [US1] Modify `frontend/src/components/modals/UserFormModal.tsx` — remove `password` and `confirmPassword` fields from the create branch; update form state type to omit `password`; rename the submit button from "Create User" to "Send Invite" on the create branch; update validation (name + email + role only for new users)
- [X] T016 [US1] Modify `frontend/src/components/settings/UserAccountsTab.tsx` — replace `api.createUser` call with `api.inviteUser`; add `'invited'` to the status filter dropdown (`<SelectItem value="invited">Invited</SelectItem>`); add amber/yellow `<Badge>Invited</Badge>` variant for `status === 'invited'` in the table; remove the "Reset Password" (`<Key>`) action button from the actions column

**Checkpoint**: Admin can open the invite modal, enter name/email/role, click "Send Invite", and see the new user appear in the list with an "Invited" badge. Email dispatched (check logs).

---

## Phase 4: User Story 2 — Invited User Sets Their Password (Priority: P1)

**Goal**: Invited user clicks email link → `/accept-invite?token=…` → sets password → account activated → redirected to `/login`.

**Independent Test**: Generate a valid token manually via `InvitationService::issue()` in a test, hit `POST /api/auth/accept-invite` with it, confirm user `status` becomes `active` and `password` is set; confirm the same token is rejected on second use.

### Implementation

- [X] T017 [US2] Implement `AuthController::acceptInvite()` in `backend/app/Controllers/Api/AuthController.php` — validate `token` (non-empty) and `password` (≥ 8 chars); call `InvitationService::accept()`; return `200` on success or `400` with descriptive message on invalid/expired/used token
- [X] T018 [US2] Complete `InvitationService::accept()` in `backend/app/Services/InvitationService.php` — hash token, query `user_invitations` for matching hash where `accepted_at IS NULL` and `invalidated_at IS NULL` and `expires_at > NOW()`; if not found return `false`; update `user_invitations.accepted_at`; update `users.password = bcrypt($password)` and `users.status = 'active'`; audit-log `user.invite_accepted`; return `true`
- [X] T019 [US2] Create `frontend/src/pages/AcceptInvitePage.tsx` — public page; reads `?token` from `useSearchParams()`; if token missing shows "Invalid Link" card with link to contact admin; form: "New password" + "Confirm password" fields (React Hook Form + Zod, min 8 chars, must match); on submit calls `api.acceptInvite({ token, password })`; on success shows checkmark and redirects to `/login` after 3 s; on error shows server error message; uses same card/layout style as `ForgotPasswordPage.tsx` and `ResetPasswordPage.tsx`
- [X] T020 [US2] Add `acceptInvite(payload: { token: string; password: string }): Promise<void>` to `frontend/src/api/api.ts` — calls `POST /auth/accept-invite`
- [X] T021 [US2] Register `/accept-invite` as a public route in `frontend/src/App.tsx` — add `<Route path="/accept-invite" element={<AcceptInvitePage />} />` alongside `/forgot-password` and `/reset-password`; add import

**Checkpoint**: Opening `/accept-invite?token=<valid-token>` in browser shows password form. Submitting activates the account and redirects to `/login`. Reusing the token shows an error.

---

## Phase 5: User Story 3 — User Resets Their Own Password (Priority: P2)

**Goal**: Enforce self-service-only password reset by removing the admin-driven endpoint; confirm existing self-service reset (feature 044) covers all reset needs.

**Independent Test**: `POST /api/users/{id}/reset-password` returns `404` (route removed). Self-service `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` flow still works end-to-end.

### Implementation

- [X] T022 [US3] Remove `POST /api/users/(:segment)/reset-password` route from `backend/app/Config/Routes.php` (delete the route line; keep resend-invite route intact)
- [X] T023 [US3] Remove `resetPassword()` method from `backend/app/Controllers/Api/UserController.php` — delete the entire method body and signature
- [X] T024 [US3] Remove `ResetPasswordModal` import and usage from `frontend/src/components/settings/UserAccountsTab.tsx` — remove `import`, the `showPasswordModal` state, `setShowPasswordModal` setter, the modal JSX block, and the `<Key>` action button (already removed in T016); verify no remaining references
- [X] T025 [US3] Delete `frontend/src/components/modals/ResetPasswordModal.tsx` — remove file entirely (it provided the admin-driven reset UI; no longer needed)
- [X] T026 [P] [US3] Remove `resetUserPassword` from `frontend/src/api/api.ts` — delete the method definition (already done in T014; verify no remaining references in other files by searching for `resetUserPassword` across `frontend/src/`)

**Checkpoint**: `POST /api/users/{id}/reset-password` → 404. No "Reset Password" key icon anywhere in the Users table. Self-service forgot-password flow unaffected.

---

## Phase 6: User Story 4 — Admin Resends an Invitation (Priority: P3)

**Goal**: Admin can resend an invitation to a user whose status is still `invited`; old token is invalidated.

**Independent Test**: Invite a user → resend → confirm old token rejected → confirm new token works → confirm only one active invitation row exists in DB for that user.

### Implementation

- [X] T027 [US4] Implement `UserController::resendInvite(string $id)` in `backend/app/Controllers/Api/UserController.php` — requires admin/super-admin JWT; fetch user by ID in caller's tenant; reject with `400` if `status !== 'invited'`; call `InvitationService::resend()`; return `200` with generic success message
- [X] T028 [US4] Complete `InvitationService::resend()` in `backend/app/Services/InvitationService.php` — call `invalidatePending($email, $tenantId)` to set `invalidated_at` on the existing invitation row; then call `issue()` to create a new token and send a fresh email; audit-log `user.invite_resent`
- [X] T029 [US4] Add `resendInvite(userId: string): Promise<void>` to `frontend/src/api/api.ts` — calls `POST /users/{userId}/resend-invite`
- [X] T030 [US4] Add "Resend Invite" action button in `frontend/src/components/settings/UserAccountsTab.tsx` — show `<RefreshCw>` icon button only when `user.status === 'invited'`; calls `api.resendInvite(user.id)`; shows toast on success/error; reloads user list

**Checkpoint**: Admin sees "Resend Invite" button for invited users. Clicking it sends a new email and the previous link stops working.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T031 [P] Add `'invited'` status to the `User` TypeScript type in `frontend/src/types/dashboard.ts` — update `status` field type from `'active' | 'inactive'` to `'active' | 'inactive' | 'invited'`
- [X] T032 [P] Update `filterStatus` Select in `frontend/src/components/settings/UserAccountsTab.tsx` — confirm "Invited" option renders in the status filter dropdown and the `filteredUsers` memo correctly handles the `'invited'` value
- [X] T033 Rate-limit `POST /api/users/invite` in `backend/app/Controllers/Api/UserController.php` — add throttler check: 10 invites per JWT user per minute (matches login rate-limit pattern)
- [X] T034 Verify `ProtectedRoute` in `frontend/src/components/ProtectedRoute.tsx` — confirm that `invited` accounts cannot reach protected routes; since `invited` users can never obtain a JWT (login is blocked at T007), this is inherently safe — add a comment confirming the assumption
- [X] T035 [P] Run `php spark migrate` in `backend/` and verify with `DESCRIBE user_invitations` and `SHOW COLUMNS FROM users LIKE 'status'` per quickstart.md
- [X] T036 [P] Manual end-to-end smoke test per `quickstart.md`: invite → extract token from logs → accept-invite → login with new password; confirm login blocked for still-pending account

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational) ─┐
                               ├─► Phase 3 (US1 — Admin Invites) 🎯 MVP
                               ├─► Phase 4 (US2 — Accept Invite) — depends on US1 backend token issuance
                               ├─► Phase 5 (US3 — Self-Service Reset) — independent, can run after Phase 2
                               └─► Phase 6 (US4 — Resend) — depends on US1 (invite must exist to resend)
Phase 7 (Polish) ─ depends on all story phases complete
```

### User Story Dependencies

- **US1 (P1 — Admin Invites)**: Depends only on Phase 1+2. No US dependency. Start here.
- **US2 (P1 — Accept Invite)**: Depends on US1 backend being complete (token issuance). Frontend page is independent.
- **US3 (P2 — Self-Service Only Reset)**: Fully independent after Phase 2. Can run in parallel with US1/US2.
- **US4 (P3 — Resend)**: Depends on US1 (invitations must exist before resend makes sense).

### Within Each User Story

- Backend model/service → backend controller → backend route → frontend API client → frontend UI

### Parallel Opportunities

- T001 + T002 + T005 + T006 can run in parallel (different files, no interdependencies)
- T009 + T010 can run in parallel (same file, different route groups — must be sequential within same file)
- T014 + T015 + T016 can run in parallel (different files)
- T019 + T020 + T021 can run in parallel (different files)
- US3 tasks (T022–T026) can run in parallel with US1/US2 after Phase 2

---

## Parallel Execution Examples

### Phase 1 — Run these together

```
T001: Create user_invitations migration
T002: Add invited status migration
T005: Create user_invitation.php email template
T006: Add sendInvitation() to EmailService
```

### US1 Backend + Frontend — Run these together

```
T011: Modify UserController::invite() (backend)
T014: Add inviteUser() to api.ts (frontend)
T015: Modify UserFormModal.tsx (frontend)
```

### US2 Backend + Frontend — Run these together

```
T017: Implement AuthController::acceptInvite() (backend)
T019: Create AcceptInvitePage.tsx (frontend)
T020: Add acceptInvite() to api.ts (frontend)
```

### US3 Removals — Run these together

```
T022: Remove route from Routes.php
T023: Remove resetPassword() from UserController
T024: Remove modal usage from UserAccountsTab
T025: Delete ResetPasswordModal.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1 (Setup) — ~4 tasks
2. Complete Phase 2 (Foundational) — ~4 tasks
3. Complete Phase 3 (US1 — Admin Invites) — ~6 tasks
4. Complete Phase 4 (US2 — Accept Invite) — ~5 tasks
5. **STOP and VALIDATE**: Full invite loop works end-to-end (invite → email → accept → login)
6. Ship MVP — admin no longer sets passwords for new users

### Full Delivery (All Stories)

1. MVP above
2. Phase 5 (US3 — Remove admin reset) — ~5 tasks
3. Phase 6 (US4 — Resend) — ~4 tasks
4. Phase 7 (Polish) — ~6 tasks

---

## Notes

- **[P]** = can run in parallel with other [P] tasks in the same phase (different files, no incomplete dependencies)
- **[USn]** = traceability label mapping task to user story n from spec.md
- T007 (login block for `invited` accounts) is the most critical safety gate — implement and test it before any invite flows go live
- The `password` column on `users` accepts `NULL` for invited accounts — verify the `users` table schema allows `NULL` on `password` (check `CreateDBSchemas` migration; add a migration to drop the NOT NULL constraint if needed, before T001–T002 run)
- `ResetPasswordModal.tsx` deletion (T025) should only happen after confirming no other component imports it (search `frontend/src` for `ResetPasswordModal` before deleting)
