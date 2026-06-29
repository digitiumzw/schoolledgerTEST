# Implementation Plan: Billing Plans Management

**Branch**: `026-billing-plans-management` | **Date**: 2026-04-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/026-billing-plans-management/spec.md`

## Summary

Refactor the billing section to support exactly three paid subscription tiers (Starter, Growth, Enterprise), remove the Free plan entirely, and add: plan upgrade/downgrade with student-count validation, per-payment invoice generation with PDF download, and a condensed billing history showing only significant events (payments, activations, upgrades, downgrades, renewals, expirations) paginated at 20 per page.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · TanStack React Query · shadcn/ui · TailwindCSS · Paynow PHP SDK  
**Storage**: MySQL — existing `subscription_plans`, `school_subscriptions`, `subscription_payment_transactions` tables; new `subscription_invoices` and `billing_events` tables via migrations  
**Testing**: PHPUnit (backend) · Vitest / React Testing Library (frontend)  
**Target Platform**: Web (Linux server + React SPA)  
**Project Type**: Web service (REST API) + React SPA  
**Performance Goals**: Billing overview loads within 2 s; plan change completes within 3 min end-to-end  
**Constraints**: All DB queries must include `tenant_id` filter; plan changes require confirmed Paynow payment; downgrade blocked when student count > target plan limit  
**Scale/Scope**: Per-tenant; one active subscription at a time; 20-event paginated history

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Multi-Tenant Data Isolation** | ✅ Pass | All new queries on `subscription_invoices` and `billing_events` will filter by `tenant_id` sourced from JWT. Existing subscription queries already compliant. |
| **II. API-First Separation** | ✅ Pass | New invoice download endpoint and billing events endpoint added to backend REST API; frontend consumes via `api.ts` only. |
| **III. JWT Auth & Role-Based Access** | ✅ Pass | All new routes added under the existing `$routes->group('subscription', ...)` block which is inside the JWT-protected group. `admin` and `super_admin` roles enforced for plan changes; `bursar` added for read-only history/invoice access consistent with the existing `history` route. |
| **IV. Immutable Migrations** | ✅ Pass | Free plan removal is a data change (seeder update + soft-deactivation migration), not an edit to existing migration files. New tables added via new migration files. |
| **V. Financial Ledger Integrity** | ✅ Pass | Subscription invoices are financial records. Invoice amounts are copied from the confirmed payment transaction at generation time — never computed as a mutable cached column. |

## Project Structure

### Documentation (this feature)

```text
specs/026-billing-plans-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── subscription-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   └── SubscriptionController.php     # extend: downgrade, invoice download, billing events
│   ├── Models/
│   │   ├── SubscriptionInvoiceModel.php   # new
│   │   └── BillingEventModel.php          # new
│   ├── Services/
│   │   ├── InvoiceService.php             # new — PDF generation + invoice record creation
│   │   └── BillingEventService.php        # new — write significant events
│   └── Database/
│       ├── Migrations/
│       │   ├── 2026-04-12-100000_Create_subscription_invoices_table.php   # new
│       │   ├── 2026-04-12-110000_Create_billing_events_table.php          # new
│       │   └── 2026-04-12-120000_Deactivate_free_plan.php                 # new (data migration)
│       └── Seeds/
│           └── SubscriptionPlanSeeder.php  # update: remove free plan, rename standard→starter, advanced→growth

frontend/
├── src/
│   ├── pages/
│   │   └── Billing.tsx                    # refactor: replace history table, add invoice list, downgrade support
│   ├── components/subscription/
│   │   ├── PlanSelector.tsx               # update: remove free plan card, support downgrade
│   │   ├── PlanCard.tsx                   # update: show upgrade/downgrade label per current plan
│   │   ├── InvoiceList.tsx                # new — invoice table with download button
│   │   └── BillingHistoryList.tsx         # new — significant-events-only history with pagination
│   ├── hooks/
│   │   └── useSubscription.ts             # extend: downgrade support, invoice download
│   └── api/
│       └── api.ts                         # extend: getInvoices, downloadInvoice, getBillingEvents endpoints
```

**Structure Decision**: Web application (Option 2). Backend REST API in CodeIgniter 4; React SPA frontend. New models and services introduced for invoices and billing events. Existing `SubscriptionController` extended rather than replaced to minimise diff.
