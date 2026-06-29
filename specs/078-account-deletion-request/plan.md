# Implementation Plan: Account Deletion Request

**Branch**: `078-account-deletion-request` | **Date**: 2026-05-19 | **Spec**: specs/078-account-deletion-request/spec.md
**Input**: Feature specification from `/specs/078-account-deletion-request/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement an Account Deletion Request feature allowing tenant admins to request deletion of their SchoolLedger account. The feature includes: (1) A 7-day grace period during which tenants can undo the deletion request, (2) Automated reminder emails sent every 3 days during the grace period, (3) A PHP Spark CLI command that runs via cron job to process expired deletion requests, (4) Super Admin-controlled permanent deletion that removes all tenant-related data from the database, and (5) An audit log tracking deletion requests for compliance. The technical approach leverages the existing PHP 8.1/CodeIgniter 4/MySQL backend and React 18/TypeScript frontend with email service integration.

## Technical Context

**Language/Version**: PHP 8.1+, React 18, TypeScript  
**Primary Dependencies**: CodeIgniter 4, MySQL, TanStack React Query, Axios, TailwindCSS, shadcn/ui  
**Storage**: MySQL with tenant-scoped tables (all tables have tenant_id foreign key)  
**Testing**: curl-based integration tests for API endpoints (per Constitution Principle X)  
**Target Platform**: Web application (Linux server, modern browsers)  
**Project Type**: Web application with full-stack separation (backend API + frontend SPA)  
**Performance Goals**: <200ms for deletion request/undo API calls; <60 seconds for tenant data deletion command (10k student records)  
**Constraints**: 7-day grace period is fixed (not configurable); deletion is irreversible; Super Admin only for permanent deletion execution  
**Scale/Scope**: Single tenant deletion; handles up to 10,000+ student records per tenant with batch deletion queries

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Principles Compliance:**

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | All tenant-scoped queries use tenant_id from JWT. Deletion audit log entries scoped by tenant. Super Admin operations verified via role check. |
| II. API-First Separation | ✅ PASS | Frontend communicates via REST API only. All business logic (grace period calculation, deletion processing) in backend services. |
| III. JWT Authentication & RBAC | ✅ PASS | Deletion request endpoints require admin role. Permanent deletion requires Super Admin role. JWTAuthFilter on all new routes. |
| IV. Immutable Migrations | ✅ PASS | New migration adds deletion_requested_at and status to tenants table. Separate migration for deletion_audit_log table. |
| V. Financial Ledger Integrity | ✅ N/A | No ledger calculations involved in this feature. |
| VI. REST API Standards | ✅ PASS | Endpoints: `POST /api/tenant/deletion-request`, `POST /api/tenant/undo-deletion`, `GET /api/tenant/deletion-status`. Consistent JSON envelope via BaseApiController. |
| VII. Code Quality | ✅ PASS | Services follow single responsibility: TenantDeletionService for business logic, TenantDeletionCommand for CLI, EmailNotificationService for reminders. |
| VIII. Defensive Security | ✅ PASS | Input validation on all endpoints. Role checks before deletion operations. Confirmation dialog required for destructive actions. |
| IX. Error Handling | ✅ PASS | Explicit error handling with proper HTTP status codes. Errors logged with tenant context. No stack traces in API responses. |
| X. API Endpoint Testing | ✅ PASS | curl tests defined in quickstart.md for: happy path request/undo, unauthorized access, tenant isolation, deletion command execution. |
| XI. Backend-Driven Data | ✅ PASS | Grace period remaining days calculated backend-side. Tenant deletion status returned in API response. No client-side date math. |
| XII. Mutation Loading States | ✅ PASS | Loading indicators on request/undo actions. React Query cache invalidated after mutations. Controls disabled during requests. |

**Backend-Driven Data Confirmation:**
- Remaining grace period days: Computed in backend (`daysRemaining = 7 - daysSince(deletion_requested_at)`)
- Deletion status: Returned as `pending_deletion` enum value from backend
- Audit log entries: Queried backend-side for admin review (future enhancement)

**Query Efficiency Strategy:**
- Index on `tenants.status` for filtering pending deletions in cron job
- Index on `tenants.deletion_requested_at` for date-based queries
- Tenant deletion uses batch DELETE queries per table rather than row-by-row
- Deletion audit log has composite index on `(tenant_id, requested_at)`

**Mutation Loading States Confirmation:**
- `useTenantDeletion` hook exposes `isRequestingDeletion` and `isUndoingDeletion` pending states
- Settings page shows loading spinner on delete/undo button during mutation
- React Query `invalidateQueries(['tenant', 'settings'])` called after successful mutation
- Optimistic updates NOT used for deletion status (too risky); wait for server confirmation

## Project Structure

### Documentation (this feature)

```text
specs/078-account-deletion-request/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Commands/                    # CLI commands
│   │   └── TenantDeletion.php       # Spark command for deletion processing
│   ├── Config/
│   │   └── Routes.php               # API route definitions (add tenant deletion routes)
│   ├── Controllers/
│   │   └── Api/
│   │       └── TenantDeletionController.php  # REST endpoints for deletion request/undo/status
│   ├── Database/
│   │   └── Migrations/
│   │       ├── 2026-05-19-000001_AddDeletionFieldsToTenants.php
│   │       └── 2026-05-19-000002_CreateDeletionAuditLogTable.php
│   ├── Models/
│   │   ├── TenantModel.php          # Add deletion scope methods
│   │   └── DeletionAuditLogModel.php # Audit log for deletion requests
│   └── Services/
│       ├── TenantDeletionService.php       # Business logic for deletion operations
│       └── TenantDeletionEmailService.php  # Email notifications
└── tests/
    └── Integration/
        └── TenantDeletionTest.php   # curl-based integration tests

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                   # Add tenant deletion API methods
│   ├── hooks/
│   │   └── useTenantDeletion.ts     # React Query hooks for deletion operations
│   ├── components/
│   │   └── settings/
│   │       └── AccountDeletionCard.tsx  # UI for deletion request/undo
│   ├── pages/
│   │   └── Settings.tsx             # Add Account tab with deletion feature
│   └── types/
│       └── dashboard.ts             # Add deletion-related TypeScript interfaces
```

**Structure Decision**: Option 2: Web application (backend + frontend). Using existing SchoolLedger structure: PHP 8.1/CodeIgniter 4 backend at `backend/` and React 18/TypeScript frontend at `frontend/`. All backend code follows existing patterns (Controllers in `Controllers/Api/`, Models in `Models/`, Services in `Services/`). Frontend follows existing patterns (hooks in `hooks/`, components in `components/settings/` for settings-related UI).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | - | Constitution Check passes all principles |
