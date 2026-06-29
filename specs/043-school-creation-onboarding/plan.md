# Implementation Plan: School Creation & Admin Onboarding

**Branch**: `043-school-creation-onboarding` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/043-school-creation-onboarding/spec.md`

## Summary

Enable a platform super-admin to create a new school by supplying only a school name and admin email. The system auto-generates a temporary password, sends a welcome email via the existing `EmailService`, and creates the tenant + admin user in a `pending` state. On first login, the admin is routed through a 5-step onboarding wizard (password change prompt → admin profile → school contact details → work hours → academic calendar → fee structure). Completion activates the tenant, auto-enrolls it in a 3-month trial using the existing unlimited-students `subscription_plans` record, and redirects to the dashboard. The feature spans three layers: new platform API endpoints (CodeIgniter 4), new school-side onboarding API endpoints, and two new frontend flows (platform "create school" modal enhancement + React wizard for the school-side admin).

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · JWT (backend) · Vite · TanStack React Query · shadcn/ui · React Hook Form + Zod (frontend)  
**Storage**: MySQL — `tenants`, `users`, `school_subscriptions`, `subscription_plans` tables (existing); new columns and one new table via immutable migrations  
**Testing**: PHPUnit (`composer test`) · backend integration tests in `backend/tests/`  
**Target Platform**: Linux server (backend) · web browser SPA (frontend)  
**Project Type**: Full-stack web service (REST API + React SPA)  
**Performance Goals**: Welcome email dispatched within 60 s of creation (SC-001); onboarding form submission < 500 ms p95  
**Constraints**: All tenant-scoped queries MUST include `tenant_id` from JWT. Platform routes use `platform-jwt-auth` filter. School-side routes use `JWTAuthFilter`. Temporary password never expires by time — invalidated on first successful login only.  
**Scale/Scope**: One new platform endpoint group, one new school-side endpoint group, ~5 new React pages/components, 2 new migrations, 1 new service class.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | **Multi-Tenant Data Isolation** | ✅ PASS | All new school-side queries will include `tenant_id` from JWT. Platform endpoints operate on `tenants` table without tenant-scoping (correct — platform layer is cross-tenant by design). |
| II | **API-First Separation of Concerns** | ✅ PASS | Frontend wizard calls backend via Axios instance in `src/api/api.ts`. No DB access from frontend. No presentation logic in controllers. |
| III | **JWT Authentication & Role-Based Access** | ✅ PASS | Platform creation endpoint requires `platform-jwt-auth` with `Owner`/`Admin` role check (via `canManageTenants`). School-side onboarding endpoints require `JWTAuthFilter`; role enforced as `admin`. Dashboard access guarded by onboarding-complete check. |
| IV | **Immutable Migrations** | ✅ PASS | New schema additions (credential invalidation flag on `users`, onboarding progress table) will be new migration files. No existing migrations edited. |
| V | **Financial Ledger Integrity** | ✅ PASS | No ledger tables touched. |
| VI | **REST API Standards** | ✅ PASS | All new endpoints use plural nouns, kebab-case paths, and `respondSuccess`/`respondError` helpers. |
| VII | **Code Quality & Maintainability** | ✅ PASS | Business logic extracted to a new `SchoolProvisioningService`; controllers remain thin. |
| VIII | **Defensive Security** | ✅ PASS | Temporary password generated with `random_bytes` + bcrypt-hashed before storage. Plain-text password sent once in welcome email then discarded. All inputs validated/sanitised. Unique constraint on `users.email` prevents race-condition duplicates. |
| IX | **Error Handling & Observability** | ✅ PASS | Email delivery failures caught, school record preserved, alert surfaced to platform user. All errors use `respondError` envelope. Internal details never exposed to API consumer. |
| X | **Integration Testing** | ✅ PASS | Integration tests required: school creation happy path, duplicate email rejection, onboarding completion + trial enrollment, dashboard-guard bypass attempt. |
| XI | **Performance Discipline** | ✅ PASS | No speculative optimizations. Subscription enrollment is a single INSERT. Onboarding progress uses indexed `user_id` lookup. |

**Gate result**: All 11 principles pass. ✅ Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/043-school-creation-onboarding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── platform-school-creation.md
│   └── school-onboarding.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/
│   │   ├── Platform/
│   │   │   └── TenantsController.php          # extend store() to provision admin + send email
│   │   └── Api/
│   │       └── OnboardingController.php       # NEW — school-side onboarding endpoints
│   ├── Services/
│   │   └── SchoolProvisioningService.php      # NEW — create tenant + user + subscription
│   ├── Models/
│   │   └── OnboardingProgressModel.php        # NEW
│   └── Database/
│       └── Migrations/
│           ├── 2026-04-27-100000_Add_credential_flags_to_users.php   # NEW
│           └── 2026-04-27-100001_Create_onboarding_progress_table.php # NEW
└── tests/
    └── Feature/
        └── SchoolProvisioningTest.php          # NEW integration tests

frontend/
└── src/
    ├── admin/
    │   └── pages/
    │       └── Schools.tsx                     # extend: "Create School" modal (name + email only)
    ├── pages/
    │   └── OnboardingPage.tsx                  # NEW — multi-step wizard
    ├── components/
    │   └── onboarding/
    │       ├── StepPasswordChange.tsx          # NEW
    │       ├── StepAdminProfile.tsx            # NEW
    │       ├── StepContactDetails.tsx          # NEW
    │       ├── StepWorkHours.tsx               # NEW
    │       ├── StepAcademicCalendar.tsx        # NEW
    │       └── StepFeeStructure.tsx            # NEW
    ├── hooks/
    │   └── useOnboarding.ts                    # NEW — React Query hooks for onboarding API
    └── api/
        └── api.ts                              # extend: add onboarding + provisioning calls
```

**Structure Decision**: Web application (Option 2). Backend follows existing `Controllers/Platform/` + `Controllers/Api/` split. Frontend follows existing `admin/pages/` + `src/pages/` + `src/components/` conventions. New `SchoolProvisioningService` keeps controllers thin (Principle VII). No new top-level project directories introduced.

## Complexity Tracking

> No constitution violations requiring justification.
