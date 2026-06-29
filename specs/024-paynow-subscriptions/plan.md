# Implementation Plan: Paynow Subscription Packages

**Branch**: `024-paynow-subscriptions` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-paynow-subscriptions/spec.md`

## Summary

Add a tiered subscription system to SchoolLedger that gates feature access by student count and collects recurring payments via the Paynow gateway. Four tiers (Free / Standard / Advanced / Enterprise) will replace the previously removed flat subscription approach. The backend adds three new tables (`subscription_plans`, `school_subscriptions`, `subscription_payment_transactions`), a `SubscriptionController`, a `PaynowService`, and middleware to enforce plan limits. The frontend adds a Billing/Subscription page, a plan-selector component, and a `useSubscription` hook.

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4, `firebase/php-jwt` ^7.0, Paynow PHP SDK (or direct cURL to Paynow REST API), React Query (TanStack), React Hook Form + Zod, shadcn/ui, TailwindCSS  
**Storage**: MySQL (via CodeIgniter 4 Query Builder) — three new tables; existing `tenants` table is read for student count  
**Testing**: PHPUnit ^10 (backend unit + integration) · Vitest (frontend)  
**Target Platform**: Linux web server (Apache/Nginx) + React SPA served via Vite  
**Project Type**: Web application (separate backend API + React SPA)  
**Performance Goals**: Subscription status check on each protected request ≤ 10 ms (cached per request); Paynow initiation round-trip ≤ 3 s  
**Constraints**: All subscription queries MUST include `tenant_id` filter (Principle I); payment webhook endpoint MUST be public (no JWT); all other subscription routes under `api/*` are JWT-protected (Principle III)  
**Scale/Scope**: One active subscription record per school; up to four plan tiers; Paynow webhook handling must be idempotent

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Multi-Tenant Data Isolation** | ✅ PASS | All three new tables carry `tenant_id`; every query filters by `tenant_id` sourced from JWT payload. |
| **II. API-First Separation** | ✅ PASS | Frontend talks to backend exclusively through `/api/subscription/*` REST routes. No DB access from React. |
| **III. JWT Auth & Role-Based Access** | ✅ PASS (with one justified exception) | All subscription management routes are JWT-protected. The Paynow webhook callback (`POST /api/subscription/webhook`) is intentionally public — see Complexity Tracking. |
| **IV. Immutable Migrations** | ✅ PASS | Three new migration files will be created; no existing migrations edited. |
| **V. Financial Ledger Integrity** | ✅ PASS (N/A to ledger) | Subscription payments are stored in a separate `subscription_payment_transactions` table and do not interact with the student fee ledger. |

**Post-design re-check**: All gates still pass after Phase 1 design. The webhook exception is justified and documented below.

## Project Structure

### Documentation (this feature)

```text
specs/024-paynow-subscriptions/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── subscription-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   └── SubscriptionController.php      # new
│   ├── Models/
│   │   ├── SubscriptionPlanModel.php       # new
│   │   ├── SchoolSubscriptionModel.php     # new
│   │   └── SubscriptionTransactionModel.php # new
│   ├── Services/
│   │   └── PaynowService.php               # new
│   ├── Config/
│   │   └── Routes.php                      # updated: add /api/subscription/* routes
│   └── Database/
│       └── Migrations/
│           ├── 2026-04-10-100000_Create_subscription_plans_table.php    # new
│           ├── 2026-04-10-110000_Create_school_subscriptions_table.php  # new
│           └── 2026-04-10-120000_Create_subscription_transactions_table.php # new

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                          # updated: add subscription API methods
│   ├── hooks/
│   │   └── useSubscription.ts              # new
│   ├── components/
│   │   └── subscription/
│   │       ├── PlanCard.tsx                # new
│   │       ├── PlanSelector.tsx            # new
│   │       └── SubscriptionStatusBanner.tsx # new
│   └── pages/
│       └── Billing.tsx                     # new
```

**Structure Decision**: Option 2 (web application) — backend API + React SPA. No new top-level project directories; feature fits cleanly into existing `backend/` and `frontend/` trees.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Webhook route (`POST /api/subscription/webhook`) is public (no JWT) | Paynow's server cannot send a JWT; the webhook must be accessible without authentication | Paynow cannot be configured to send a Bearer token; signature-based verification (Paynow hash) is used instead as the security layer |
