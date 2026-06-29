# Implementation Plan: Platform Admin Schools Page Redo

**Branch**: `042-admin-schools-page` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/042-admin-schools-page/spec.md`

## Summary

Rebuild the Platform Admin Schools page (`frontend/src/admin/pages/Schools.tsx`) and its supporting backend to address five concrete gaps discovered through code inspection:

1. **Subdomain exposure** — `subdomain` is rendered in the Profile tab detail view (line 423) and is included in both `index()` and `show()` query selects in `TenantsController.php`.
2. **Delete safeguards incomplete** — the backend `delete()` checks only `payments` and `charges` tables but not `subscription_invoices` or `billing_events`; the frontend uses a bare `confirm()` dialog with no name-confirmation step.
3. **Suspend/Reactivate state sync gap** — after suspend/reactivate, the detail sheet closes (`setSelected(null)`) rather than reflecting the new status inline; the list row also relies on full query invalidation rather than an optimistic update, which can leave the UI stale momentarily.
4. **Billing tab invoice access** — the Billing tab in the sheet reads `selected.recent_invoices` (embedded in the tenant object from `show()`, limited to 5, no download button). Invoices should be fetched independently per-tenant with full listing, filtering, status display, and PDF download via the existing `GET /finance/invoices/:id/pdf` endpoint.
5. **Invoice status missing** — the `show()` endpoint joins `subscription_invoices` but does not join `subscription_payment_transactions` to derive invoice status; the Billing tab renders amount only, no status badge.

The backend already has all necessary route infrastructure (`suspend`, `reactivate`, `delete`, `invoicePdf`). Only targeted additions and fixes are required.

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · TanStack React Query · shadcn/ui · Sonner (toasts) · Tailwind CSS  
**Storage**: MySQL (via CI4 Query Builder) — tables: `tenants`, `subscription_invoices`, `subscription_payment_transactions`, `payments`, `charges`, `billing_events`  
**Testing**: CI4 test runner (`php spark test`) for backend; no automated frontend test runner currently configured  
**Target Platform**: Web — platform-admin console (`admin-frontend`, separate origin from tenant `frontend`)  
**Project Type**: Web application (React SPA + CI4 REST API)  
**Performance Goals**: Schools list page load ≤2 s for up to 500 tenants; invoice PDF download initiates within 1 s of button click  
**Constraints**: Platform-admin JWT must be used for all API calls; no impersonation token may be involved in invoice download; no client-side filtering of tenant list  
**Scale/Scope**: Single page (`Schools.tsx`) + one backend controller (`TenantsController.php`) + one backend financial-records check extension; no new routes needed for core features — one new route needed for per-tenant invoice listing from the Tenants controller

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | Platform endpoints are not tenant-scoped (no `tenant_id` from JWT); backend reads cross-tenant data via platform-admin JWT with `platform-jwt-auth` filter. No tenant isolation violation. |
| II | API-First Separation of Concerns | ✅ PASS | All frontend changes consume the existing REST API; no direct DB access from the frontend. |
| III | JWT Authentication & Role-Based Access | ✅ PASS | All platform routes are under the `platform-jwt-auth` filter. `canDeleteTenants` and `canManageTenants` role checks are already enforced in `TenantsController.php`. |
| IV | Immutable Migrations | ✅ PASS | No schema changes required. All data is already in existing tables. |
| V | Financial Ledger Integrity | ✅ PASS | No ledger-touching queries. Invoice data is read-only for display/download. |
| VI | REST API Standards & Consistent Responses | ✅ PASS | All new/modified endpoints follow existing pattern: `$this->success()` / `$this->error()`. One new route added following existing naming convention. |
| VII | Code Quality & Maintainability | ✅ PASS | Changes are scoped and minimal: extend existing functions, extract billing tab to a sub-component, replace `confirm()` with a proper dialog. |
| VIII | Defensive Security | ✅ PASS | Backend delete already validates financial records before executing; this plan extends the check. No user inputs stored unsanitized. |
| IX | Error Handling & Observability | ✅ PASS | All mutations use Sonner `toast.error()` on failure. New billing tab queries use React Query error states surfaced as inline error messages. |
| X | Integration Testing | ⚠️ NOTE | Backend integration tests for the extended `delete()` check (covering `subscription_invoices` and `billing_events`) should be added to `backend/tests/Controllers/Platform/`. Frontend has no automated test runner; manual verification is the current standard. |
| XI | Performance Discipline | ✅ PASS | Per-tenant invoice list fetched lazily only when Billing tab is opened (not eagerly on tenant select). No N+1 change in the list view — student/staff counts are already per-row queries (existing pattern, not introduced by this feature). |

**Gate result**: PASS — no violations require justification. Integration tests (Principle X) flagged as a task to add for the backend delete extension.

## Project Structure

### Documentation (this feature)

```text
specs/042-admin-schools-page/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (touched files)

```text
backend/
├── app/
│   ├── Controllers/
│   │   └── Platform/
│   │       └── TenantsController.php       ← extend delete() check; add tenantInvoices()
│   └── Config/
│       └── Routes.php                      ← add GET tenants/:id/invoices route
└── tests/
    └── Controllers/
        └── Platform/
            └── TenantsControllerTest.php   ← new integration test for delete safeguard

frontend/
└── src/
    └── admin/
        ├── pages/
        │   └── Schools.tsx                 ← primary change: all five gaps
        └── components/
            └── admin/
                └── TenantBillingTab.tsx    ← new: extracted billing tab component
```

**Structure Decision**: Web application layout (backend + frontend). Only the files listed above are touched; no new pages, no new routes except one.

## Complexity Tracking

> No constitution violations to justify.
