# Implementation Plan: Reset Password

**Branch**: `044-reset-password` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/044-reset-password/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement a secure password reset flow that allows users who have forgotten their passwords to regain account access. The feature adds a "Forgot Password?" link on the login page that initiates a token-based reset flow: users submit their email, receive a time-limited secure link, and set a new password. Implementation spans both backend (CodeIgniter 4 API with JWT auth) and frontend (React SPA with shadcn/ui forms).

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript/React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend), Vite + TailwindCSS + shadcn/ui (frontend)  
**Storage**: MySQL with CodeIgniter ORM  
**Testing**: PHPUnit (backend), Vitest + React Testing Library (frontend), Playwright (E2E)  
**Target Platform**: Linux server (backend), Modern browsers (frontend)  
**Project Type**: Multi-tenant SaaS web application (SchoolLedger)  
**Performance Goals**: <200ms p95 for API responses, password reset email delivery within 5 minutes  
**Constraints**: Must comply with GDPR/data privacy for student/financial data, JWT-based auth required  
**Scale/Scope**: Multi-tenant architecture supporting 1000+ schools

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | Password reset tokens are user-scoped; tenant_id filtered via JWT on all other endpoints |
| II. API-First Separation | ✅ PASS | All reset operations via `/api/auth/*` endpoints; frontend uses Axios through `api.ts` |
| III. JWT Authentication | ✅ PASS | Reset endpoints are public (by design), all other endpoints require JWT; role checks enforced |
| IV. Immutable Migrations | ✅ PASS | New migration for `password_reset_tokens` table; no edits to existing migrations |
| V. Financial Ledger Integrity | ✅ N/A | No ledger operations in this feature |
| VI. REST API Standards | ✅ PASS | Endpoints: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password/{token}`; consistent JSON envelopes |
| VII. Code Quality | ✅ PASS | Small focused functions, custom hooks for form logic, no duplication |
| VIII. Defensive Security | ✅ PASS | Input validation, rate limiting, secure token generation, password hashing, CSRF protection on forms |
| IX. Error Handling | ✅ PASS | Explicit error handling, generic messages to API consumers, detailed logging |
| X. Integration Testing | ✅ PASS | Integration tests for happy path, error cases, rate limiting |
| XI. Performance Discipline | ✅ PASS | Token lookup indexed by token+email; no N+1 queries |

**GATE STATUS**: ✅ **PASSED** - All principles satisfied or N/A.

## Project Structure

### Documentation (this feature)

```text
specs/044-reset-password/
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
│   ├── Config/
│   │   ├── Routes.php          # Add /api/auth/forgot-password, /api/auth/reset-password/{token}
│   │   └── Filters.php         # JWT filter (reset endpoints public)
│   ├── Controllers/
│   │   └── AuthController.php  # forgotPassword(), resetPassword() methods
│   ├── Database/
│   │   └── Migrations/
│   │       └── 2026-04-27-CreatePasswordResetTokensTable.php
│   ├── Models/
│   │   └── PasswordResetTokenModel.php
│   └── Services/
│       └── PasswordResetService.php
└── tests/
    └── integration/
        └── PasswordResetTest.php

frontend/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx          # Add "Forgot Password?" link
│   │   ├── ForgotPasswordPage.tsx # Email input form
│   │   └── ResetPasswordPage.tsx  # New password form
│   ├── components/
│   │   └── auth/
│   │       ├── ForgotPasswordForm.tsx
│   │       └── ResetPasswordForm.tsx
│   ├── hooks/
│   │   └── usePasswordReset.ts
│   └── api/
│       └── auth.ts               # forgotPassword(), resetPassword() API calls
└── tests/
    └── integration/
        └── password-reset.spec.ts
```

**Structure Decision**: Option 2 (Web application) - Backend API with CodeIgniter 4, React SPA frontend. All password reset functionality follows existing project conventions.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (None) | - | - |

---

## Phase Completion

### Phase 0: Research ✅ COMPLETE
- **Artifact**: [research.md](./research.md)
- **Unknowns Resolved**: Token generation strategy, expiration policy, rate limiting approach, email template design, password complexity requirements, database schema decisions, frontend state management approach
- **No NEEDS CLARIFICATION items remain**

### Phase 1: Design & Contracts ✅ COMPLETE
- **Artifacts**:
  - [data-model.md](./data-model.md) - Entity definitions, relationships, migration code
  - [contracts/auth-api.md](./contracts/auth-api.md) - API contracts, TypeScript types, Zod schemas
  - [quickstart.md](./quickstart.md) - Development setup, testing guide, debugging
- **Constitution Re-check**: All 11 principles satisfied (see table above)
- **Agent Context**: Updated with PHP 8.1+, TypeScript/React, CodeIgniter 4, MySQL

## Summary of Generated Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Specification | [spec.md](./spec.md) | User stories, requirements, success criteria |
| Implementation Plan | [plan.md](./plan.md) | This file - technical context, constitution check |
| Research | [research.md](./research.md) | Technical decisions, alternatives considered |
| Data Model | [data-model.md](./data-model.md) | Entity definitions, migration code |
| API Contracts | [contracts/auth-api.md](./contracts/auth-api.md) | Endpoint specs, types, validation |
| Quickstart | [quickstart.md](./quickstart.md) | Testing, debugging, common issues |
| Quality Checklist | [checklists/requirements.md](./checklists/requirements.md) | Spec validation |

## Next Steps

1. Run `/speckit.tasks` to generate the actionable, dependency-ordered task list
2. Run `/speckit.implement` to execute the implementation

## Post-Design Constitution Check

**Re-evaluated after Phase 1 design - ALL PRINCIPLES PASS**:
- ✅ I. Multi-Tenant Data Isolation - Token scoped to email, JWT for other endpoints
- ✅ II. API-First Separation - All operations via `/api/auth/*` endpoints
- ✅ III. JWT Authentication - Reset endpoints public by design, JWT elsewhere
- ✅ IV. Immutable Migrations - New migration created, no edits to existing
- ✅ V. Financial Ledger Integrity - N/A for this feature
- ✅ VI. REST API Standards - Proper naming, consistent JSON envelopes
- ✅ VII. Code Quality - Hooks, small functions, no duplication
- ✅ VIII. Defensive Security - Rate limiting, secure tokens, password hashing
- ✅ IX. Error Handling - Explicit handling, generic API messages, detailed logs
- ✅ X. Integration Testing - Test coverage defined in quickstart
- ✅ XI. Performance Discipline - Indexed queries, no N+1 patterns

**GATE STATUS**: ✅ **READY FOR TASK GENERATION**
