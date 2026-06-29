# Implementation Plan: Admin Settings Panel

**Branch**: `046-admin-settings-panel` | **Date**: 2026-04-27 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/046-admin-settings-panel/spec.md`

## Summary

Expand the existing Settings section of the Platform Admin Console (`admin-frontend` / `frontend/src/admin`) into a complete, role-enforced, security-hardened area. The console already has partial Settings (General + Team tabs) and a `platform_audit` table. This feature adds: Account self-management, invitation-based team onboarding, Access Control matrix tab, Security tab (2FA enrolment + login history), Audit Logs tab (filterable, exportable), deactivation lifecycle, immediate role-enforcement via DB re-fetch on every request, tombstone behaviour on admin removal, and a 2-year audit log retention archival mechanism. The full permission matrix (Owner / Admin / Finance / Support) must be enforced at both the API and UI layers for every Settings tab and every existing console endpoint.

---

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · Firebase JWT · TanStack Query · React Hook Form · Zod · shadcn/ui · TailwindCSS  
**Storage**: MySQL — tables `platform_users`, `platform_audit`, `platform_settings`, `platform_api_keys`; new tables: `platform_login_history`, `platform_invitations`  
**Testing**: PHPUnit (backend integration tests in `backend/tests/`) · React Testing Library (frontend, if added)  
**Target Platform**: Web — `admin-frontend` SPA served at `/platform-control-panel/*`; backend API at `/api/platform/*`  
**Project Type**: Web application — fullstack feature extending the existing Platform Admin Console  
**Performance Goals**: Audit Logs first page load < 2 s for up to 100 k rows; CSV export ≤ 10 s for 10 k rows; Account/Team mutations < 1 s p95  
**Constraints**: JWT used for identity only; role + deactivation status always re-fetched from DB per request; 2FA via TOTP (inline implementation already exists in `AuthController`); audit entries append-only / immutable; no deletion of audit rows  
**Scale/Scope**: Platform admin team is small (< 50 users); audit log can grow to millions of rows over time; 2-year active retention policy

---

## Constitution Check

*GATE: Evaluated before Phase 0. Re-checked after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | `platform_users` and `platform_audit` are platform-scoped, not tenant-scoped. No `tenant_id` filtering needed here. |
| II | API-First Separation of Concerns | ✅ PASS | All new capabilities surfaced via `/api/platform/*` endpoints; frontend calls only through `src/api/platform.ts`. |
| III | JWT Authentication & Role-Based Access | ✅ PASS | `PlatformJWTAuthFilter` enforces auth. **New**: role + status re-fetched from DB on every request (clarification Q1). Both backend and frontend enforce role checks. |
| IV | Immutable Migrations | ✅ PASS | All schema changes are new migration files. Existing migrations untouched. |
| V | Financial Ledger Integrity | ✅ N/A | This feature does not touch student charges, payments, or balances. |
| VI | REST API Standards | ✅ PASS | New endpoints follow `/api/platform/` prefix, plural noun resources, standard JSON envelope via `respondSuccess` / `respondError`. |
| VII | Code Quality | ✅ PASS | New controller methods stay small and focused; role logic stays in `PlatformPolicy` trait; no duplication. |
| VIII | Defensive Security | ✅ PASS | All inputs validated; passwords hashed with `PASSWORD_BCRYPT`; TOTP secret stored only after confirmed enrolment; invitation tokens are hashed (SHA-256); no secrets in source. |
| IX | Error Handling & Observability | ✅ PASS | All error paths use `respondError`; internal details not exposed; audit log captures all mutations. |
| X | Integration Testing | ✅ PASS | Integration tests required for every new endpoint: happy path, error path, role-enforcement path. |
| XI | Performance Discipline | ✅ PASS | Audit log uses server-side pagination + indexed `created_at` / `actor_user_id` columns; CSV streamed server-side; no speculative optimisation. |

**Complexity Tracking** — no violations requiring justification.

---

## Project Structure

### Documentation (this feature)

```text
specs/046-admin-settings-panel/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── platform-settings-api.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Platform/
│   │   ├── SettingsController.php          ← extend: account, deactivate, 2FA owner-disable
│   │   ├── AuthController.php              ← extend: 2FA enrol/disable, login-history
│   │   └── AuditController.php             ← NEW: paginated audit log + CSV export
│   ├── Filters/
│   │   └── PlatformJWTAuthFilter.php       ← extend: DB role re-fetch on every request
│   ├── Libraries/
│   │   └── PlatformPolicy.php              ← extend: canViewAuditLog, canManageOwnAccount, canReadTeam
│   ├── Models/
│   │   ├── PlatformUser.php                ← extend: status field, deactivation, tombstone helper
│   │   ├── PlatformAudit.php               ← extend: filterable paginated query, actor_name snapshot
│   │   └── PlatformLoginHistory.php        ← NEW
│   └── Database/Migrations/
│       ├── 2026-04-27-400000_Add_status_actor_name_to_platform_users.php   ← NEW
│       ├── 2026-04-27-400001_Create_platform_login_history_table.php       ← NEW
│       ├── 2026-04-27-400002_Add_actor_name_email_snapshot_to_platform_audit.php ← NEW
│       └── 2026-04-27-400003_Create_platform_invitations_table.php         ← NEW
│
└── tests/
    └── Controllers/Platform/
        ├── SettingsControllerTest.php       ← NEW: account CRUD, 2FA, deactivation
        ├── AuditControllerTest.php          ← NEW: audit log listing, filtering, CSV export
        └── PlatformJWTAuthFilterTest.php    ← NEW / extend: immediate role-enforcement

frontend/
└── src/
    ├── admin/
    │   ├── pages/
    │   │   └── Settings.tsx                ← REWRITE: 6-tab layout
    │   ├── components/admin/settings/
    │   │   ├── AccountTab.tsx              ← NEW
    │   │   ├── TeamTab.tsx                 ← NEW (refactored from Settings.tsx)
    │   │   ├── AccessControlTab.tsx        ← NEW
    │   │   ├── SecurityTab.tsx             ← NEW
    │   │   └── AuditLogsTab.tsx            ← NEW
    │   └── hooks/
    │       ├── useSettings.ts              ← extend: account mutations, 2FA, deactivation
    │       └── useAuditLogs.ts             ← NEW
    └── api/
        └── platform.ts                    ← extend: account, 2FA, login-history, audit, deactivate
```

**Structure Decision**: Web application (Option 2). Backend lives in `backend/`, frontend in `frontend/src/admin/`. New admin-panel components go into `frontend/src/admin/components/admin/settings/` following the existing component convention.
