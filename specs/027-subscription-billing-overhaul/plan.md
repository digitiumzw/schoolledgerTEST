# Implementation Plan: Subscription Billing Overhaul

**Branch**: `027-subscription-billing-overhaul` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/027-subscription-billing-overhaul/spec.md`

## Summary

Remove the EcoCash / OneMoney mobile-money payment path entirely, replace it with a Paynow-redirect confirmation dialog, hardcode the Enterprise plan as the recommended option, add graceful cancellation detection on return from Paynow, and optimise the backend polling endpoint to short-circuit on terminal transaction states and prevent duplicate subscription activations.

No database schema changes are required — all changes are in existing controllers, models, hooks, and page components.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4, JWT, MySQL (backend) · Vite, TanStack React Query, shadcn/ui, React Hook Form + Zod (frontend)  
**Storage**: MySQL — `school_subscriptions`, `subscription_payment_transactions`, `subscription_invoices`, `billing_events`  
**Testing**: Manual sandbox testing via Paynow sandbox mode (isSandboxMode() returns true when credentials are missing)  
**Target Platform**: Web — PHP server + React SPA  
**Project Type**: Multi-tenant SaaS web application  
**Performance Goals**: Poll endpoint response < 300ms when returning from terminal-state cache; Billing page initial load < 2s  
**Constraints**: No schema migrations needed; EcoCash endpoint can be removed from routes or left returning 410; tenant_id must always come from JWT  
**Scale/Scope**: Per-tenant billing — moderate volume; no high-concurrency concerns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | PASS | All subscription queries already filter by `tenant_id` from JWT; no new queries added that bypass this |
| II. API-First Separation | PASS | Dialog logic lives in frontend; no business logic added to React components; polling moved to hook |
| III. JWT Auth & Role-Based Access | PASS | `initiate()` and `initiateEcocash()` already require `admin` / `super_admin`; no role changes needed; removing EcoCash route does not affect auth |
| IV. Immutable Migrations | PASS | No schema changes; no migrations needed |
| V. Financial Ledger Integrity | PASS | No charges/payments queries touched; balance computation unaffected |

**Gate result**: All principles satisfied. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/027-subscription-billing-overhaul/
├── plan.md              ✅ This file
├── research.md          ✅ Phase 0 output
├── data-model.md        ✅ Phase 1 output
├── quickstart.md        ✅ Phase 1 output
├── contracts/           ✅ Phase 1 output
│   └── subscription-api.md
└── tasks.md             ⬜ Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (files touched by this feature)

```text
backend/
└── app/
    └── Controllers/
        └── Api/
            └── SubscriptionController.php   # poll() optimised; resolveRecommendedPlan() hardcoded; initiateEcocash() removed from routes

frontend/
└── src/
    ├── hooks/
    │   └── useSubscription.ts               # EcoCash logic removed; hook simplified
    ├── pages/
    │   └── Billing.tsx                      # EcoCash UI removed; confirmation dialog wired; cancellation handling added
    └── components/
        └── subscription/
            ├── SubscribeConfirmDialog.tsx   # NEW — redirect confirmation + payment method list
            ├── PlanCard.tsx                 # No change needed (labels already correct)
            ├── PlanSelector.tsx             # No change needed
            ├── InvoiceList.tsx              # No change needed
            └── BillingHistoryList.tsx       # No change needed
```

**Structure Decision**: Web application (backend + frontend). Only existing directories are modified; one new component file is added.
