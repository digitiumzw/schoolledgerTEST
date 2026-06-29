# Implementation Plan: Subscription Billing Cycle Transition Rules

**Branch**: `071-subscription-cycle-rules` | **Date**: 2026-05-11 | **Spec**: `/specs/071-subscription-cycle-rules/spec.md`
**Input**: Feature specification from `/specs/071-subscription-cycle-rules/spec.md`

## Summary

Enforce one-way subscription billing-cycle movement for tenants: monthly subscriptions may move to annual, annual subscriptions may not move back to monthly, and active annual subscriptions may only change plan tier inside the same annual cycle. The implementation will extend the existing subscription/proration subsystem rather than creating a separate billing module: `SubscriptionController`, `ProrationService`, `SchoolSubscriptionModel`, `SubscriptionPlanModel`, Paynow-backed `SubscriptionTransactionModel`, `ProrationCalculationModel`, `BillingEventService`, and platform admin subscription management will be updated to consistently apply the rule across tenant-facing and platform-facing paths.

Key implementation direction:

- Keep existing `school_subscriptions.billing_cycle`, `starts_at`, and `expires_at` as the subscription source of truth.
- Reuse existing `proration_calculations` for annual tier changes, adding policy metadata only if needed for audit clarity.
- Reject annual → monthly transitions before creating calculations, pending subscriptions, transactions, or platform overrides.
- Allow monthly → annual transitions through the normal subscription initiation flow, with a full annual renewal period unless a future implementation explicitly adds monthly unused-time crediting.
- Preserve `expires_at` for all annual in-cycle tier changes.
- Use `billing_events` and audit logs for traceability.

## Technical Context

**Language/Version**: PHP 8.1+ backend; TypeScript 5 / React 18 frontend  
**Primary Dependencies**: CodeIgniter 4 REST API; MySQL; Paynow integration; React Query; Vite; TailwindCSS; shadcn/ui  
**Storage**: MySQL tables already present for `school_subscriptions`, `subscription_plans`, `subscription_transactions`, `proration_calculations`, `subscription_credits`, `subscription_invoices`, and `billing_events`  
**Testing**: PHP lint; frontend TypeScript type-check; targeted ESLint; post-implementation curl endpoint validation per constitution  
**Target Platform**: Linux-hosted web application with CodeIgniter API and React SPA  
**Project Type**: Full-stack multi-tenant SaaS web application  
**Performance Goals**: Subscription change validation and proration previews complete within normal interactive request time; no N+1 tenant or subscription lookups introduced  
**Constraints**: Tenant data must be scoped by JWT-derived `tenant_id`; state-changing subscription endpoints must be role-protected; renewal date preservation must be deterministic; no annual downgrade refunds  
**Scale/Scope**: Existing school tenant subscription management for platform admins and tenant admins; feature touches subscription billing rules only, not student ledger billing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Multi-Tenant Data Isolation**: PASS — Tenant-facing subscription APIs use JWT-derived `tenant_id`; platform routes are platform-scoped and must not accept tenant-owned data access without explicit platform authorization.
2. **API-First Separation of Concerns**: PASS — Billing-cycle and proration rules belong in backend services/controllers; frontend only displays allowed actions and API responses.
3. **JWT Authentication & Role-Based Access**: PASS — Existing `/api/subscription/*` endpoints are JWT-protected; tenant changes limited to `admin`/`super_admin`; read-only subscription history can remain available to `bursar` where already allowed.
4. **Immutable Migrations**: PASS — If schema additions are required for explicit policy/audit fields, create new migrations only.
5. **Financial Ledger Integrity**: PASS — Feature concerns SaaS subscription billing, not student charges/payments ledger; no student balance logic is modified.
6. **REST API Standards & Consistent Responses**: PASS — Existing REST endpoints and `BaseApiController` response envelope will be preserved.
7. **Code Quality & Maintainability**: PASS — Centralize transition validation in a service/helper to avoid duplicating annual/monthly guard logic across initiate, proration, and platform admin flows.
8. **Defensive Security**: PASS — Validate target plan, billing cycle, calculation ownership, calculation expiry, and downgrade plan limits before state mutation.
9. **Error Handling & Observability**: PASS — Annual → monthly attempts return explicit safe errors and are logged as billing/audit events where appropriate.
10. **API Endpoint Testing via curl**: PASS — Quickstart defines post-implementation curl tests for happy paths, error paths, and tenant isolation.
11. **Performance Discipline**: PASS — No speculative heavy processing; only constant-time plan/subscription lookups and existing indexed tenant-scoped tables.

## Project Structure

### Documentation (this feature)

```text
specs/071-subscription-cycle-rules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── subscription-cycle-rules.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php
│   ├── Controllers/
│   │   ├── Api/
│   │   │   └── SubscriptionController.php
│   │   └── Platform/
│   │       └── SubscriptionsController.php
│   ├── Database/
│   │   └── Migrations/
│   ├── Models/
│   │   ├── SchoolSubscriptionModel.php
│   │   ├── SubscriptionPlanModel.php
│   │   ├── SubscriptionTransactionModel.php
│   │   └── ProrationCalculationModel.php
│   └── Services/
│       ├── ProrationService.php
│       └── BillingEventService.php
└── tests/

frontend/
├── src/
│   ├── api/
│   │   ├── api.ts
│   │   └── platform.ts
│   ├── admin/
│   │   └── pages/
│   │       └── Subscriptions.tsx
│   └── components/
│       └── subscription/
└── tests/
```

**Structure Decision**: Use the existing backend subscription controller/service/model structure and existing frontend tenant/platform subscription UI. No new application boundary is required.

## Phase 0: Research

Research is captured in `/specs/071-subscription-cycle-rules/research.md`.

## Phase 1: Design & Contracts

Design artifacts:

- `/specs/071-subscription-cycle-rules/data-model.md`
- `/specs/071-subscription-cycle-rules/contracts/subscription-cycle-rules.md`
- `/specs/071-subscription-cycle-rules/quickstart.md`

## Post-Design Constitution Check

1. **Multi-Tenant Data Isolation**: PASS — Contracts require tenant-facing operations to resolve subscription by JWT tenant only; no tenant ID request override.
2. **API-First Separation of Concerns**: PASS — Contracts keep rule enforcement backend-authoritative; frontend affordances are advisory only.
3. **JWT Authentication & Role-Based Access**: PASS — Tenant mutation endpoints require `admin`/`super_admin`; platform mutations require platform subscription-management permission.
4. **Immutable Migrations**: PASS — Data model identifies optional additive fields only; any implementation must use new migration files.
5. **Financial Ledger Integrity**: PASS — Student ledger remains untouched.
6. **REST API Standards & Consistent Responses**: PASS — Contracts use existing endpoint naming and JSON envelope patterns.
7. **Code Quality & Maintainability**: PASS — Research selects centralized transition policy validation.
8. **Defensive Security**: PASS — Contracts include invalid cycle, invalid plan, calculation ownership, expired calculation, and annual-to-monthly blocked errors.
9. **Error Handling & Observability**: PASS — Annual-to-monthly blocked attempts require explicit error code and event/audit trace.
10. **API Endpoint Testing via curl**: PASS — Quickstart includes required curl validations after implementation.
11. **Performance Discipline**: PASS — No high-volume loops; subscription updates remain transaction-safe, bounded operations.

## Complexity Tracking

No constitution violations or added architectural complexity are required.
