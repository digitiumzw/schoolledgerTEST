# Implementation Plan: Invitation-Based User Onboarding

**Branch**: `045-invite-user-onboarding` | **Date**: 2026-04-27 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/045-invite-user-onboarding/spec.md`

## Summary

Replace the current admin-sets-password user creation flow with a secure invitation-based flow. Admins provide only name, email, and role; the system creates a `pending` user account, issues a hashed single-use 48-hour invitation token, and emails the invited user a link. The invited user visits a public `/accept-invite` page, sets their own password, and is redirected to login. A dedicated `user_invitations` table stores invitation records. The existing `UserController::resetPassword` admin endpoint is removed; self-service password reset (feature 044) is the only password reset path.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL · TanStack React Query · React Hook Form + Zod · shadcn/ui  
**Storage**: MySQL — new `user_invitations` table; `users.status` gains `invited` enum value  
**Testing**: PHPUnit / CodeIgniter test runner (`backend/tests/`)  
**Target Platform**: Web (multi-tenant SaaS, Linux server + browser SPA)  
**Project Type**: Web service (REST API) + React SPA  
**Performance Goals**: Invitation email dispatch < 2 s; accept-invite page token validation < 100 ms  
**Constraints**: Token must be single-use and expire in 48 h; `tenant_id` sourced exclusively from JWT; pending accounts must be denied login  
**Scale/Scope**: Per-tenant user cap of 5 active admin/bursar accounts enforced at invite time; invitations scoped per tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | All invitation queries will filter by `tenant_id` sourced from JWT. Accept-invite route is public (token carries tenant context); no cross-tenant leakage possible because tokens are matched by hash only. |
| II | API-First Separation of Concerns | ✅ PASS | All invitation logic lives in backend controllers/services; frontend only calls REST API. |
| III | JWT Authentication & Role-Based Access | ✅ PASS | `POST /api/users/invite` requires JWT + admin role. Accept-invite endpoint (`POST /api/auth/accept-invite`) is intentionally public (added to `JWTAuthFilter` public paths). |
| IV | Immutable Migrations | ✅ PASS | New migration adds `user_invitations` table and alters `users.status` enum. No existing migrations edited. |
| V | Financial Ledger Integrity | ✅ N/A | No ledger data involved. |
| VI | REST API Standards | ✅ PASS | New endpoints follow kebab-case, correct HTTP verbs, `BaseApiController` response helpers. |
| VII | Code Quality | ✅ PASS | Invitation logic extracted to `InvitationService`; no duplication with password-reset flow. |
| VIII | Defensive Security | ✅ PASS | Token stored as SHA-256 hash; plain token only in email. Pending accounts blocked at `JWTAuthFilter` login check. Input sanitized. |
| IX | Error Handling | ✅ PASS | Email send failure is non-fatal (logged, admin notified); all error paths return envelope responses. |
| X | Integration Testing | ✅ PASS | Integration tests required for: invite creation, accept flow, expired token rejection, resend, and tenant isolation. |
| XI | Performance | ✅ PASS | Single indexed query for token lookup; no N+1 introduced. |

*Post-design re-check*: All principles remain satisfied after data model and contract design (see below).

## Project Structure

### Documentation (this feature)

```text
specs/045-invite-user-onboarding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── invite-api.md    # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   ├── UserController.php          # MODIFY: replace create() + remove resetPassword()
│   │   └── AuthController.php          # MODIFY: add acceptInvite() public endpoint
│   ├── Services/
│   │   └── InvitationService.php       # NEW: invite token generation, validation, acceptance
│   ├── Models/
│   │   └── UserInvitationModel.php     # NEW: model for user_invitations table
│   ├── Database/Migrations/
│   │   ├── 2026-04-27-320000_Create_user_invitations_table.php   # NEW
│   │   └── 2026-04-27-330000_Add_invited_status_to_users.php     # NEW
│   ├── Views/emails/
│   │   └── user_invitation.php         # NEW: invitation email template
│   ├── Config/
│   │   └── Routes.php                  # MODIFY: add accept-invite + resend routes
│   └── Filters/
│       └── JWTAuthFilter.php           # MODIFY: add /api/auth/accept-invite to public paths
└── tests/
    └── Feature/
        └── UserInvitationTest.php      # NEW: integration tests

frontend/
└── src/
    ├── pages/
    │   └── AcceptInvitePage.tsx        # NEW: public page at /accept-invite?token=…
    ├── components/
    │   ├── modals/
    │   │   └── UserFormModal.tsx       # MODIFY: remove password field; rename button to "Invite"
    │   └── settings/
    │       └── UserAccountsTab.tsx     # MODIFY: add invited status badge; add Resend action; remove ResetPassword action
    ├── components/modals/
    │   └── ResetPasswordModal.tsx      # REMOVE (or keep for edit-only; password field removed from create)
    ├── api/
    │   └── api.ts                      # MODIFY: replace createUser (with password) with inviteUser; add resendInvite; remove resetUserPassword
    └── App.tsx                         # MODIFY: add /accept-invite public route
```

**Structure Decision**: Web application layout (Option 2). Backend in `backend/`, frontend in `frontend/src/`. New `InvitationService` isolates token logic to keep controllers thin and DRY relative to the existing password-reset token pattern.

## Complexity Tracking

> No constitution violations requiring justification.
