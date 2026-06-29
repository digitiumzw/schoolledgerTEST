# Tasks: Admin Settings Panel

**Input**: Design documents from `specs/046-admin-settings-panel/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.  
**Tests**: Integration tests included per Constitution Principle X (mandatory).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new files and directories required by this feature before any user story work begins.

- [X] T001 Create component directory `frontend/src/admin/components/admin/settings/` (AccountTab, TeamTab, AccessControlTab, SecurityTab, AuditLogsTab placeholders)
- [X] T002 Create test directory `backend/tests/Controllers/Platform/` if not present
- [X] T003 [P] Scaffold empty `backend/app/Controllers/Platform/AuditController.php` with class stub and namespace
- [X] T004 [P] Scaffold empty `backend/app/Models/PlatformLoginHistory.php` with class stub and namespace

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migrations, filter upgrade, and policy extension that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Write migration `backend/app/Database/Migrations/2026-04-27-400000_Add_status_and_recovery_to_platform_users.php` — adds `status` ENUM(`Active`,`Invited`,`Deactivated`) DEFAULT `Active` and `two_factor_recovery_hash` VARCHAR(255) NULL to `platform_users`
- [X] T006 Write migration `backend/app/Database/Migrations/2026-04-27-400001_Create_platform_login_history_table.php` — creates `platform_login_history` table with columns: `id`, `platform_user_id` (FK→platform_users SET NULL), `email_attempted`, `ip_address`, `user_agent`, `outcome` ENUM(`success`,`failed`), `failure_reason`, `created_at`; indexes on `platform_user_id`, `created_at`
- [X] T007 Write migration `backend/app/Database/Migrations/2026-04-27-400002_Add_actor_snapshot_to_platform_audit.php` — adds `actor_name` VARCHAR(255) NULL and `actor_email` VARCHAR(255) NULL to `platform_audit`; adds index on `actor_email`
- [X] T008 Write migration `backend/app/Database/Migrations/2026-04-27-400003_Create_platform_invitations_table.php` — creates `platform_invitations` table with columns: `id`, `platform_user_id` (FK→platform_users CASCADE), `invited_by` (FK→platform_users SET NULL), `token_hash` VARCHAR(64) UNIQUE, `expires_at`, `accepted_at` NULL, `created_at`; indexes on `token_hash`, `platform_user_id`, `expires_at`
- [X] T009 Extend `backend/app/Filters/PlatformJWTAuthFilter.php` — after JWT signature validation, re-fetch `platform_role` and `status` from `platform_users` by `$tokenData->id`; return 401 if user not found or `status === 'Deactivated'`; overwrite `$request->platformUser->platform_role` and `->status` with live DB values
- [X] T010 Extend `backend/app/Libraries/PlatformPolicy.php` — add methods: `canChangeTeamRole(string $role): bool` (Owner only), `canDeactivateTeamMember(string $role): bool` (Owner + Admin), `canViewAuditLog(string $role): bool` (all roles), `canManageOwnAccount(string $role): bool` (all roles), `canDisableOtherAdmin2FA(string $role): bool` (Owner only); update `canManageSettings` to include Admin
- [X] T011 Extend `backend/app/Models/PlatformUser.php` — add `status` and `two_factor_recovery_hash` to `$allowedFields`; add `deactivate(int $id)`, `activate(int $id)`, `tombstoneAuditEntries(int $id)` helper methods; update validation rules to include `status` in_list
- [X] T012 Implement `backend/app/Models/PlatformLoginHistory.php` — `$table = 'platform_login_history'`, `$allowedFields`, `logAttempt(...)` static helper that inserts a row; `forUser(int $userId, int $limit = 20)` query method
- [X] T013 Extend `backend/app/Models/PlatformAudit.php` — update `log()` static method to snapshot `actor_name` and `actor_email` from `platform_users` at write time; add `filteredPaginated(array $filters, int $page, int $perPage)` method with stackable WHERE clauses for `from_date`, `to_date`, `actor_email`, `action`, `target_type`; add `filteredAll(array $filters)` for CSV export; add composite index usage in queries
- [X] T014 Update `backend/app/Libraries/AuditService.php` — extend `logFromRequest` to pass actor name + email to `PlatformAudit::log` so snapshots are always written

**Checkpoint**: Migrations applied (`php spark migrate`), filter re-fetches role from DB, policy methods exist, models updated. All user stories can now begin.

---

## Phase 3: User Story 1 — Admin Updates Their Own Account Details (Priority: P1) 🎯 MVP

**Goal**: Any signed-in platform admin can update their name, email, and password from Settings → Account.

**Independent Test**: Navigate to Settings → Account, change display name, save, reload — updated name persists. Change password with wrong current password — rejected with error.

### Implementation for User Story 1

- [X] T015 [US1] Add routes to `backend/app/Config/Routes.php` — `PUT api/platform/account` → `SettingsController::updateAccount`, `PUT api/platform/account/password` → `SettingsController::updatePassword`
- [X] T016 [US1] Implement `SettingsController::updateAccount` in `backend/app/Controllers/Platform/SettingsController.php` — validates name (non-empty) and email (valid, unique across `platform_users` excluding self); updates record; emits `platform.account.update` audit entry with snapshot of old→new values
- [X] T017 [US1] Implement `SettingsController::updatePassword` in `backend/app/Controllers/Platform/SettingsController.php` — verifies `current_password` via `password_verify`; validates `new_password` min 8 chars and matches confirmation; hashes and saves; emits `platform.account.password_change` audit entry (no password value in details)
- [X] T018 [P] [US1] Add API functions to `frontend/src/api/platform.ts` — `updateAccount(data)` → `PUT /account`, `updatePassword(data)` → `PUT /account/password`
- [X] T019 [P] [US1] Add mutations to `frontend/src/admin/hooks/useSettings.ts` — `useUpdateAccount()` and `useUpdatePassword()` with React Query `useMutation`; invalidate `['platform','me']` on success; toast on success/error
- [X] T020 [US1] Implement `frontend/src/admin/components/admin/settings/AccountTab.tsx` — two cards: (1) Profile form (name + email, RHF + Zod validation); (2) Password form (current_password, new_password, confirmation, RHF + Zod); both use hooks from T019; show inline field errors; success toast on save
- [X] T021 [US1] Rewrite `frontend/src/admin/pages/Settings.tsx` — replace 2-tab layout with 6-tab layout (`account`, `team`, `access-control`, `security`, `audit-logs`, `general`); render `<AccountTab />` for `account` tab; keep existing general/team content as stubs for remaining tabs
- [X] T022 [US1] Write integration test `backend/tests/Controllers/Platform/SettingsControllerTest.php` — test `updateAccount`: happy path (name change), duplicate email rejected (409), unauthenticated (401); test `updatePassword`: happy path, wrong current password (401), too short (400)

**Checkpoint**: Account tab fully functional. Any platform admin can update their own profile and password independently of all other tabs.

---

## Phase 4: User Story 2 — Owner Invites and Manages Platform Team Members (Priority: P1)

**Goal**: Owners and Admins can invite new team members via email (invitation-based, no password field). Owners can change roles and deactivate/remove members.

**Independent Test**: Invite a Finance-role member → Invited status appears in team list → accept invite → login as Finance role → Finance permissions enforced.

### Implementation for User Story 2

- [X] T023 [US2] Add routes to `backend/app/Config/Routes.php` — `POST api/platform/auth/accept-invite` (public), `POST api/platform/team/(:num)/resend-invite`, `POST api/platform/team/(:num)/deactivate`, `DELETE api/platform/team/(:num)/2fa` (Owner-only 2FA disable)
- [X] T024 [US2] Rewrite `SettingsController::inviteTeamMember` in `backend/app/Controllers/Platform/SettingsController.php` — remove `password` field; create `platform_users` record with `status='Invited'` and empty `password_hash`; generate `bin2hex(random_bytes(32))` invitation token; store `hash('sha256', $token)` in `platform_invitations`; dispatch invitation email via `EmailService`; emit `platform.team.invite` audit entry
- [X] T025 [US2] Implement `AuthController::acceptInvite` in `backend/app/Controllers/Platform/AuthController.php` — public endpoint; validate token against `platform_invitations` (not expired, not accepted); validate password min 8 chars + confirmation; set `password_hash`, `status='Active'`; mark invitation `accepted_at`; emit `platform.team.invite_accepted` audit entry; return success (no JWT — redirect to login)
- [X] T026 [US2] Implement `SettingsController::resendInvite` in `backend/app/Controllers/Platform/SettingsController.php` — Owner/Admin only; verify member status is `Invited`; expire old `platform_invitations` row; generate new token; dispatch new invitation email; emit audit entry
- [X] T027 [US2] Implement `SettingsController::deactivateTeamMember` in `backend/app/Controllers/Platform/SettingsController.php` — Owner/Admin only (`canDeactivateTeamMember`); prevent deactivating self; prevent deactivating last active Owner (count check); set `status='Deactivated'`; emit `platform.team.deactivate` audit entry
- [X] T028 [US2] Tighten `SettingsController::changeTeamMemberRole` in `backend/app/Controllers/Platform/SettingsController.php` — change guard from `canManageTeam` to `canChangeTeamRole` (Owner only); prevent changing role of last active Owner to non-Owner
- [X] T029 [US2] Update `SettingsController::removeTeamMember` in `backend/app/Controllers/Platform/SettingsController.php` — after deletion call `PlatformUser::tombstoneAuditEntries($id)` to set `actor_name='[Removed Admin]'` on all that user's audit rows (email snapshot preserved)
- [X] T030 [US2] Implement `SettingsController::disableTeamMember2FA` in `backend/app/Controllers/Platform/SettingsController.php` — Owner only (`canDisableOtherAdmin2FA`); calls `PlatformUser::disable2FA($id)`; emits `platform.team.disable_2fa` audit entry with both actor and target identities
- [X] T031 [P] [US2] Add API functions to `frontend/src/api/platform.ts` — `acceptInvite(token, password, confirmation)`, `resendInvite(id)`, `deactivateTeamMember(id)`, `disableTeamMember2FA(id)`; update `inviteTeamMember` to remove `password` field
- [X] T032 [P] [US2] Add mutations to `frontend/src/admin/hooks/useSettings.ts` — `useDeactivateTeamMember()`, `useResendInvite()`, `useDisableTeamMember2FA()`; invalidate `['platform','team']` on success
- [X] T033 [US2] Implement `frontend/src/admin/components/admin/settings/TeamTab.tsx` — full team management UI; member table with columns: avatar, name, email, role badge, status badge (Active/Invited/Deactivated), last-login; role `<Select>` shown only when signed-in user is Owner; deactivate button for Owner/Admin; remove button for Owner (with `AlertDialog` confirmation); resend invite button for Invited members; "Disable 2FA" action in Owner-only overflow menu; invite dialog using new no-password form
- [X] T034 [US2] Wire `<TeamTab />` into `frontend/src/admin/pages/Settings.tsx` for the `team` tab
- [X] T035 [US2] Create accept-invite public frontend page `frontend/src/admin/pages/AcceptInvitePage.tsx` — reads `?token=` from URL; renders password + confirmation form (RHF + Zod); submits to `acceptInvite` API; on success redirects to `/platform-control-panel/login`; shows expired/invalid token error state
- [X] T036 [US2] Add `/platform-control-panel/accept-invite` route to `frontend/src/admin/PlatformApp.tsx` (public, no auth guard)
- [X] T037 [US2] Write integration tests `backend/tests/Controllers/Platform/SettingsControllerTest.php` (extend) — invite flow: happy path, duplicate email (409), wrong role forbidden (403); accept-invite: happy path, expired token (400), already accepted (400); deactivate: happy path, last-Owner guard (409), Admin cannot deactivate Owner (403); role change: Owner success, Admin rejected (403); remove + tombstone: audit rows updated

**Checkpoint**: Full invitation lifecycle works. Team management complete with role-guarded actions.

---

## Phase 5: User Story 6 — Role-Based Access Enforced Across the Entire Console (Priority: P1)

**Goal**: Every console endpoint enforces the role-permission matrix at the backend; the frontend hides/disables disallowed controls per signed-in role.

**Independent Test**: Log in as Finance role, attempt to suspend tenant via direct `curl` — 403 returned. Log in as Support, attempt plan creation — 403. Log in as Admin, attempt permanent tenant delete — 403.

### Implementation for User Story 6

- [X] T038 [US6] Audit and fix role guards on ALL existing platform controllers — verify each action in `backend/app/Controllers/Platform/` uses the correct `PlatformPolicy` method per the `data-model.md` matrix; fix any gap (e.g., `TenantsController::delete` must require Owner; `PlansController` create/edit/retire must allow Finance; `SettingsController::update` must now allow Admin)
- [X] T039 [US6] Add `canSuspendTenant` and `canImpersonateTenant` policy checks where missing in `backend/app/Libraries/PlatformPolicy.php` and apply in `backend/app/Controllers/Platform/TenantsController.php` (Support can suspend/reactivate/impersonate but not create/delete)
- [X] T040 [P] [US6] Implement `usePlatformRole` or extend `AuthContext` in `frontend/src/admin/contexts/AuthContext.tsx` — expose helper `can(action: string): boolean` that evaluates the local role-permission matrix; used by UI components to show/hide controls
- [X] T041 [P] [US6] Apply role-based UI gating in `frontend/src/admin/pages/Schools.tsx` — hide/disable create, suspend, reactivate, impersonate, delete buttons per signed-in role using `can()` helper
- [X] T042 [P] [US6] Apply role-based UI gating in `frontend/src/admin/pages/Subscriptions.tsx` — hide plan create/edit/retire and subscription change/cancel for Support role
- [X] T043 [P] [US6] Apply role-based UI gating in `frontend/src/admin/pages/Finance.tsx` — hide CSV export and invoice actions for Support role
- [X] T044 [US6] Write integration test `backend/tests/Controllers/Platform/RoleEnforcementTest.php` — for each role (Owner, Admin, Finance, Support), call each restricted endpoint and assert correct 200 or 403; cover at minimum: tenant delete (Owner only), tenant suspend (not Finance), plan create (not Support), settings write (Owner+Admin), team role change (Owner only), audit log read (all roles)

**Checkpoint**: Role matrix fully enforced at API layer. Frontend gates applied. Verified by automated tests.

---

## Phase 6: User Story 3 — Admin Views the Role-Permission Matrix (Priority: P2)

**Goal**: Any signed-in admin can view the role-permission matrix in Settings → Access Control (read-only, no API call).

**Independent Test**: Log in as any role, open Settings → Access Control — table renders all 4 roles and all console sections with correct indicators; no edit controls present.

### Implementation for User Story 3

- [X] T045 [P] [US3] Implement `frontend/src/admin/components/admin/settings/AccessControlTab.tsx` — static read-only table component; rows = console sections, columns = Owner/Admin/Finance/Support; cell values: "Full", "Read-only", "None", or specific text (e.g., "suspend/reactivate only"); derived directly from `data-model.md` matrix; no API call; no edit controls
- [X] T046 [US3] Wire `<AccessControlTab />` into `frontend/src/admin/pages/Settings.tsx` for the `access-control` tab

**Checkpoint**: Access Control tab renders correctly for all roles. Zero backend work required.

---

## Phase 7: User Story 4 — Admin Manages 2FA and Views Login History (Priority: P2)

**Goal**: Any platform admin can enrol in/disable TOTP 2FA for their own account and view their personal login history.

**Independent Test**: Enrol 2FA on a test account → log out → log in → TOTP prompt appears → enter valid code → access granted. View Security tab → last 20 login events displayed.

### Implementation for User Story 4

- [X] T047 [US4] Add routes to `backend/app/Config/Routes.php` — `POST api/platform/auth/2fa/setup`, `POST api/platform/auth/2fa/confirm`, `DELETE api/platform/auth/2fa`, `GET api/platform/auth/login-history`
- [X] T048 [US4] Implement `AuthController::setup2FA` in `backend/app/Controllers/Platform/AuthController.php` — generates Base32 TOTP secret using `random_bytes`; returns `otpauth://` URI and plain recovery code (stores `hash('sha256', $recoveryCode)` in `two_factor_recovery_hash`); does NOT yet enable 2FA; stores secret temporarily in session or returns it for client to cache until confirm step
- [X] T049 [US4] Implement `AuthController::confirm2FA` in `backend/app/Controllers/Platform/AuthController.php` — receives `totp_code`; verifies against secret from setup step; on success calls `PlatformUser::enable2FA($id, $secret)`; emits `platform.2fa.enabled` audit entry
- [X] T050 [US4] Implement `AuthController::disable2FA` in `backend/app/Controllers/Platform/AuthController.php` — requires `current_password`; verifies with `password_verify`; calls `PlatformUser::disable2FA($id)`; emits `platform.2fa.disabled` audit entry
- [X] T051 [US4] Update `AuthController::login` in `backend/app/Controllers/Platform/AuthController.php` — call `PlatformLoginHistory::logAttempt(...)` for every login attempt (success and failure) recording `platform_user_id`, `email_attempted`, `ip_address`, `user_agent`, `outcome`, `failure_reason`
- [X] T052 [US4] Implement `AuthController::loginHistory` in `backend/app/Controllers/Platform/AuthController.php` — returns `PlatformLoginHistory::forUser($actorId, 20)` for the signed-in admin only; no cross-admin visibility
- [X] T053 [US4] Add Owner-only platform-wide security toggle handling in `SettingsController::update` — validate that `enforce_2fa`, `auto_suspend_failed_payment_threshold`, `weekly_security_digest_enabled` keys can only be set by Owner; reject with 403 if other role attempts to set them
- [X] T054 [US4] Implement 2FA enforcement gate in `backend/app/Filters/PlatformJWTAuthFilter.php` — after DB re-fetch, if `platform_settings.enforce_2fa = true` and `$liveUser['two_factor_enabled'] = false`, return 403 with `{"status":"error","message":"2FA enrollment required","code":"2fa_required"}` so the frontend can redirect to the 2FA enrolment flow
- [X] T055 [P] [US4] Add API functions to `frontend/src/api/platform.ts` — `setup2FA()`, `confirm2FA(totpCode)`, `disable2FA(currentPassword)`, `getLoginHistory()`
- [X] T056 [P] [US4] Add hooks to `frontend/src/admin/hooks/useSettings.ts` — `useSetup2FA()`, `useConfirm2FA()`, `useDisable2FA()`, `useLoginHistory()`
- [X] T057 [US4] Implement `frontend/src/admin/components/admin/settings/SecurityTab.tsx` — two sections: (1) 2FA card: show enrolment status; if not enrolled show "Enable 2FA" button launching a multi-step dialog (QR code display → confirm TOTP code → show recovery code once); if enrolled show "Disable 2FA" button with password confirmation dialog; (2) Login history card: table of last 20 events with timestamp, IP, browser, outcome badge; Owner additionally sees platform-wide security toggles card (enforce_2fa switch, auto_suspend_threshold input, weekly_digest switch)
- [X] T058 [US4] Wire `<SecurityTab />` into `frontend/src/admin/pages/Settings.tsx` for the `security` tab
- [X] T059 [US4] Write integration test `backend/tests/Controllers/Platform/SettingsControllerTest.php` (extend) — 2FA setup→confirm flow, disable with wrong password (401), login history returns own events only, enforce_2fa toggle blocked for non-Owner (403)

**Checkpoint**: Full 2FA lifecycle working. Login history visible. Platform-wide 2FA enforcement operational.

---

## Phase 8: User Story 5 — Admin Browses and Filters the Audit Log (Priority: P2)

**Goal**: Any platform admin can view, filter, and export the full audit log from Settings → Audit Logs.

**Independent Test**: Perform known actions, open Audit Logs, filter by action type — entries appear with correct actor/action/timestamp. Export CSV — row count matches on-screen total.

### Implementation for User Story 5

- [X] T060 [US5] Add routes to `backend/app/Config/Routes.php` — `GET api/platform/audit`, `POST api/platform/audit/export`
- [X] T061 [US5] Implement `AuditController::index` in `backend/app/Controllers/Platform/AuditController.php` — any role (`canViewAuditLog`); reads query params `page`, `per_page`, `from_date`, `to_date`, `actor_email`, `action`, `target_type`; calls `PlatformAudit::filteredPaginated(...)`; returns `{ items, total, page, per_page }` in standard envelope
- [X] T062 [US5] Implement `AuditController::export` in `backend/app/Controllers/Platform/AuditController.php` — any role; reads same filter params from request body; calls `PlatformAudit::filteredAll(...)`; streams CSV response in batches of 500 rows with headers: `id,actor_name,actor_email,action,target_type,target_id,ip_address,created_at`; sets `Content-Disposition: attachment; filename="audit-log-YYYY-MM-DD.csv"`
- [X] T063 [P] [US5] Add API functions to `frontend/src/api/platform.ts` — `getAuditLog(params)` → `GET /audit?...`, `exportAuditLog(filters)` → `POST /audit/export` (blob response)
- [X] T064 [P] [US5] Create `frontend/src/admin/hooks/useAuditLogs.ts` — `useAuditLogs(filters, page)` using TanStack Query with `keepPreviousData`; `useExportAuditLog()` mutation that triggers CSV download via `URL.createObjectURL`
- [X] T065 [US5] Implement `frontend/src/admin/components/admin/settings/AuditLogsTab.tsx` — filter bar: date-range pickers, actor email input, action-type select, target-type select, Apply/Reset buttons; results table with columns: timestamp, actor (name + email), action, target type + ID, IP address; pagination controls; "Export CSV" button (disabled while exporting, shows spinner); empty state; loading skeleton
- [X] T066 [US5] Wire `<AuditLogsTab />` into `frontend/src/admin/pages/Settings.tsx` for the `audit-logs` tab
- [X] T067 [US5] Write integration test `backend/tests/Controllers/Platform/AuditControllerTest.php` — happy path paginated list, filter by `actor_email`, filter by `action`, combined filters, CSV export returns correct content-type and row structure, unauthenticated access blocked (401)

**Checkpoint**: Audit Logs tab fully operational. Filtering and CSV export verified. All roles can read logs; no role can modify them.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final wiring, cleanup, and validation across all stories.

- [X] T068 [P] Update Settings tab list in `frontend/src/admin/pages/Settings.tsx` — ensure all 6 tabs (`account`, `team`, `access-control`, `security`, `audit-logs`, `general`) render with correct labels; apply `can()` helper to hide Team write controls for Finance/Support on the tab itself (read-only mode indicator)
- [X] T069 [P] Add 2FA-required redirect in `frontend/src/admin/PlatformApp.tsx` — intercept 403 responses with `code: "2fa_required"` in `frontend/src/api/platform.ts` and redirect to a `/platform-control-panel/2fa-setup` route
- [X] T070 [P] Add `actor_name` and `actor_email` population to `AuditService::logFromRequest` in `backend/app/Libraries/AuditService.php` — fetch from `platform_users` using `$request->platformUser->id` and pass to `PlatformAudit::log` so all future log calls include snapshots automatically
- [X] T071 [P] Update `SettingsController::team` in `backend/app/Controllers/Platform/SettingsController.php` — remove the `canManageTeam` gate (all roles can view team); return `status` and `last_login_at` fields alongside existing fields; strip `password_hash`, `two_factor_secret`, `two_factor_recovery_hash`
- [ ] T072 Run `php spark migrate` and validate all 4 new migrations apply cleanly; run `backend/tests/` full suite and confirm all new tests pass
- [ ] T073 Run quickstart.md smoke tests end-to-end: account update, invite flow, access control tab render, 2FA enrolment, audit log filter + export
- [X] T074 [P] Update `backend/app/Database/Seeds/` — extend platform admin seeder (if present) to include `status='Active'` on seeded platform users so existing seeds continue to work after migration T005

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3–9 (Stories + Polish)**: All depend on Phase 2 completion
  - US1 (Phase 3), US2 (Phase 4), US6 (Phase 5) are all P1 — implement sequentially or in parallel
  - US3 (Phase 6), US4 (Phase 7), US5 (Phase 8) are P2 — begin after P1 stories
  - Phase 9 (Polish) depends on all story phases

### User Story Dependencies

- **US1 (Account)**: Independent after Phase 2
- **US2 (Team)**: Independent after Phase 2; accept-invite page (T035–T036) is independent from US1
- **US6 (Role Enforcement)**: Depends on T010 (PlatformPolicy extension from Phase 2); partially depends on US2 completion for team role guard testing
- **US3 (Access Control)**: Fully independent — frontend-only, no backend
- **US4 (Security/2FA)**: Independent after Phase 2; 2FA disable for another admin (T030) cross-references US2 route
- **US5 (Audit Logs)**: Independent after Phase 2 + T013 (PlatformAudit model extension) + T014 (AuditService snapshot)

### Within Each User Story

- Backend (route → controller → model) before frontend (API → hook → component)
- Integration tests written alongside or immediately after controller implementation
- Component implementation after hook is complete

### Parallel Opportunities

- T003, T004 (Phase 1) in parallel
- T005–T014 (Phase 2 migrations + model changes) can be split: migrations (T005–T008) in parallel; filter+policy+models (T009–T014) in parallel after migrations
- T018+T019 (US1 API + hook) in parallel
- T031+T032 (US2 API + hook) in parallel
- T040, T041, T042, T043 (US6 frontend gates) all in parallel
- T045+T046 (US3 component + wire) in parallel
- T055+T056 (US4 API + hook) in parallel
- T063+T064 (US5 API + hook) in parallel
- T068, T069, T070, T071, T074 (Polish) all in parallel

---

## Parallel Example: Phase 2 (Foundational)

```
# Run all 4 migrations together:
T005: 2026-04-27-400000_Add_status_and_recovery_to_platform_users
T006: 2026-04-27-400001_Create_platform_login_history_table
T007: 2026-04-27-400002_Add_actor_snapshot_to_platform_audit
T008: 2026-04-27-400003_Create_platform_invitations_table

# In parallel, extend existing files:
T009: PlatformJWTAuthFilter DB re-fetch
T010: PlatformPolicy new methods
T011: PlatformUser model extensions
T012: PlatformLoginHistory new model
T013: PlatformAudit filteredPaginated query
T014: AuditService snapshot pass-through
```

## Parallel Example: User Story 1 (Account)

```
# After T015 (routes):
T016: updateAccount controller
T017: updatePassword controller  (parallel with T016)
T018: platform.ts API functions  (parallel with T016+T017)
T019: useSettings.ts hooks        (parallel with T016+T017)

# After T018+T019:
T020: AccountTab.tsx component
T021: Settings.tsx 6-tab shell
T022: Integration tests
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 6 — P1 Account + Role Enforcement)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (migrations, filter, policy, models)
3. Complete Phase 3: US1 — Account tab working
4. Complete Phase 5: US6 — Role enforcement locked down at API level
5. **STOP and VALIDATE**: Account management works; all role gates verified by automated tests
6. Demo / deploy this slice

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Account) → MVP: any admin can manage their own profile
3. US2 (Team) → Invitation-based onboarding + deactivation lifecycle
4. US6 (Role Enforcement) → Full role matrix enforced everywhere
5. US3 (Access Control tab) → Role matrix visible in UI (fast win — frontend only)
6. US4 (Security/2FA) → 2FA enrolment + login history
7. US5 (Audit Logs) → Full audit log UI with filtering + CSV export
8. Polish → Final wiring, seeder fixes, smoke test pass

### Parallel Team Strategy

With two developers:
- **Dev A**: Phase 2 migrations (T005–T008) + US1 backend (T015–T017) + US2 backend (T023–T030)
- **Dev B**: Phase 2 model/filter (T009–T014) + US1 frontend (T018–T022) + US2 frontend (T031–T036)

---

## Notes

- `[P]` tasks operate on different files with no incomplete-task dependencies
- `[USn]` label maps each task to its user story for traceability
- Commit after each task or logical group; each phase checkpoint is a valid commit point
- Constitution Principle X mandates integration tests — T022, T037, T044, T059, T067 are not optional
- `two_factor_recovery_hash` is shown to the user exactly once (during 2FA setup); never expose it again
- The `[Removed Admin]` tombstone update (T029) must run inside the same DB transaction as the `platform_users` delete to avoid orphaned display names
