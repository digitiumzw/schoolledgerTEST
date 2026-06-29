# SchoolLedger Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-30

## Active Technologies
- PHP 8.1+ (backend), TypeScript 5+ (frontend) + CodeIgniter 4, MySQL (backend); React 18, Vite, TanStack Query, shadcn/ui (frontend) (021-dashboard-school-overview)
- MySQL database with tenant isolation (021-dashboard-school-overview)
- PHP 8.1+, React 18 + TypeScript + CodeIgniter 4, MySQL, TanStack React Query, React Hook Form + Zod (023-current-term-charges)
- MySQL (existing `tenants.academic_calendar` JSON column, `charges` table) (023-current-term-charges)
- PHP 8.1 (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4, `firebase/php-jwt` ^7.0, Paynow PHP SDK (or direct cURL to Paynow REST API), React Query (TanStack), React Hook Form + Zod, shadcn/ui, TailwindCSS (024-paynow-subscriptions)
- MySQL (via CodeIgniter 4 Query Builder) — three new tables; existing `tenants` table is read for student count (024-paynow-subscriptions)
- PHP 8.1+ (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · TanStack React Query · shadcn/ui · TailwindCSS · Paynow PHP SDK (026-billing-plans-management)
- MySQL — existing `subscription_plans`, `school_subscriptions`, `subscription_payment_transactions` tables; new `subscription_invoices` and `billing_events` tables via migrations (026-billing-plans-management)
- TypeScript 5 · React 18 + TanStack React Query v5, TailwindCSS, shadcn/ui (`Alert`, `Card`, `Progress`, `Skeleton`), Lucide icons (028-student-capacity-alerts)
- N/A (frontend only; data sourced from existing REST API) (028-student-capacity-alerts)
- TypeScript 5 · React 18 + TanStack React Query v5, TailwindCSS, shadcn/ui (`Alert`, `Card`, `Button`, `Skeleton`), Lucide icons, React Router v6 (029-subscription-enforcement)
- PHP 8.1+ + CodeIgniter 4, FakerPHP (fakerphp/faker), MySQL (031-database-seeder-testing)
- MySQL (existing database schema from migrations) (031-database-seeder-testing)
- PHP 8.1+ (backend), TypeScript/React 18 (frontend) + CodeIgniter 4 (backend), TanStack React Query, React Hook Form, Zod, shadcn/ui (frontend) (035-staff-attendance-filters)
- MySQL with CodeIgniter 4 ORM (035-staff-attendance-filters)
- PHP 8.1+ · CodeIgniter 4 (backend), React 18 · TypeScript (frontend) + Existing PaynowService, InvoiceService, BillingEventService (036-subscription-proration)
- MySQL via CodeIgniter 4 Models (036-subscription-proration)
- PHP 8.1+ (Backend), TypeScript/React 18 (Frontend) + CodeIgniter 4 (Backend), React 18 + Vite + TailwindCSS + shadcn/ui (Frontend), TanStack React Query, React Hook Form + Zod (037-reconciliation-submenu)
- MySQL (existing, no schema changes needed) (037-reconciliation-submenu)
- PHP 8.1+ (backend) · TypeScript 5.x / React 18 (frontend) + CodeIgniter 4, JWT, MySQL (backend) · Vite, TanStack React Query v5, shadcn/ui, React Hook Form + Zod, Axios (frontend) (039-eliminate-legacy-columns)
- MySQL — tables affected: `charges`, `payments` (039-eliminate-legacy-columns)
- PHP 8.1+ (backend), TypeScript 5 (frontend) + CodeIgniter 4, MySQL, JWT (backend); React 18, Vite, TanStack React Query, shadcn/ui, TailwindCSS (frontend) (040-admin-console)
- MySQL (new tables: platform_users, platform_settings, platform_api_keys, platform_audit) (040-admin-console)
- PHP 8.1 (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · TanStack React Query · shadcn/ui · Sonner (toasts) · Tailwind CSS (042-admin-schools-page)
- MySQL (via CI4 Query Builder) — tables: `tenants`, `subscription_invoices`, `subscription_payment_transactions`, `payments`, `charges`, `billing_events` (042-admin-schools-page)
- PHP 8.1+ (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · JWT (backend) · Vite · TanStack React Query · shadcn/ui · React Hook Form + Zod (frontend) (043-school-creation-onboarding)
- MySQL — `tenants`, `users`, `school_subscriptions`, `subscription_plans` tables (existing); new columns and one new table via immutable migrations (043-school-creation-onboarding)
- PHP 8.1+ (backend), TypeScript/React 18 (frontend) + CodeIgniter 4 (backend), Vite + TailwindCSS + shadcn/ui (frontend) (044-reset-password)
- MySQL with CodeIgniter ORM (044-reset-password)
- PHP 8.1+ (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · MySQL · TanStack React Query · React Hook Form + Zod · shadcn/ui (045-invite-user-onboarding)
- MySQL — new `user_invitations` table; `users.status` gains `invited` enum value (045-invite-user-onboarding)
- PHP 8.1+ (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · Firebase JWT · TanStack Query · React Hook Form · Zod · shadcn/ui · TailwindCSS (046-admin-settings-panel)
- MySQL — tables `platform_users`, `platform_audit`, `platform_settings`, `platform_api_keys`; new tables: `platform_login_history`, `platform_invitations` (046-admin-settings-panel)
- PHP 8.1 (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · MySQL · Vite · TailwindCSS · shadcn/ui · TanStack React Query (047-fee-billing-cycle)
- MySQL — `tenants.fee_structure` (JSON column, schema-less, no migration needed for this feature); `charges` table receives additional rows per installment under monthly mode (047-fee-billing-cycle)
- PHP 8.1 (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · MySQL · Vite · TailwindCSS · shadcn/ui · TanStack React Query · React Hook Form · Zod (050-academic-year-prefill)
- MySQL — reads `tenants.academic_calendar` (JSON) and queries `class_instances.academic_year` (VARCHAR). Zero writes for the prefill endpoint itself. (050-academic-year-prefill)
- TypeScript 5 · React 18 (frontend-only change) + TanStack React Query v5, shadcn/ui, TailwindCSS, Zod (051-class-session-display-migration)
- N/A (no schema changes; reads from existing `GET /api/settings` response) (051-class-session-display-migration)
- TypeScript 5 · React 18 + TanStack React Query v5, shadcn/ui (`Select`, `Alert`, `Button`), TailwindCSS (052-session-alert-and-config)
- N/A (no schema changes; settings are persisted via existing `PUT /api/settings`) (052-session-alert-and-config)
- PHP 8.1 (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · MySQL · Vite · shadcn/ui · TailwindCSS (053-promote-student-session-filter)
- MySQL — `enrollments` table (`academic_session` column already exists) (053-promote-student-session-filter)
- PHP 8.1+ (Backend), TypeScript/React 18 (Frontend) + CodeIgniter 4, MySQL, TanStack React Query, React Hook Form + Zod (054-transport-constraints)
- MySQL with InnoDB (ACID transactions required for reassignment atomicity) (054-transport-constraints)
- PHP 8.1+ (backend), TypeScript/React 18 (frontend) + CodeIgniter 4 (backend), TanStack Query, React Hook Form, Zod, shadcn/ui (frontend) (055-driver-kiosk-viewonly)
- MySQL with existing transport schema (transport_vehicles, transport_routes, transport_stops, transport_route_periods, transport_student_allocations) (055-driver-kiosk-viewonly)
- PHP 8.1+ (backend), TypeScript / React 18 (frontend) + CodeIgniter 4 (backend MVC + ORM), React Query / TanStack Query (frontend data fetching), shadcn/ui + TailwindCSS (frontend UI) (056-fee-structure-billing)
- MySQL — new `fee_rules` table; additive columns `fee_rule_id` + `billing_period` on existing `charges` table; UNIQUE index for deduplication (056-fee-structure-billing)
- PHP 8.1 (backend) · TypeScript 5 / React 18 (frontend) + CodeIgniter 4 (backend) · Vite + React Query + shadcn/ui + TailwindCSS (frontend) (057-payment-billing-ux)
- MySQL 5.7.8+ / MariaDB 10.2.7+ (JSON column support required for `snapshot`) (057-payment-billing-ux)
- PHP 8.1+ (Backend), TypeScript/React 18 (Frontend) + CodeIgniter 4, TanStack React Query, Axios, shadcn/ui (058-fee-campaign)
- MySQL with InnoDB for transaction support (058-fee-campaign)
- PHP 8.1+ (backend), TypeScript 5.x (frontend) + CodeIgniter 4 (backend), React 18 + TanStack Query + shadcn/ui + TailwindCSS (frontend) (059-fee-campaign)
- MySQL (existing database) (059-fee-campaign)
- `tenants.settings` JSON column (existing) — no new tables or columns (060-charge-proration-toggle)
- PHP 8.1 (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · MySQL · TanStack React Query · shadcn/ui · React Hook Form + Zod (061-non-ledger-general-payments)
- MySQL — `payments` table (additive schema change: 2 new columns) (061-non-ledger-general-payments)
- MySQL (existing database — no new tables) (062-campaign-receipt-payments)
- PHP 8.1+ backend · TypeScript + React 18 frontend + CodeIgniter 4 · MySQL · Firebase PHP JWT · React Query/Axios for frontend API consumption (063-fix-ledger-balance)
- MySQL tables: `charges`, `payments`, `ledger_adjustments`, `students` (063-fix-ledger-balance)
- Backend PHP 8.1+; frontend TypeScript 5.8+ with React 18 + CodeIgniter 4, MySQL, firebase/php-jwt, React, Vite, TailwindCSS, shadcn/ui, TanStack React Query, Axios wrapper in `frontend/src/api/api.ts` (064-rollback-void-charges)
- MySQL tables including `charges`, `billing_runs`, `payments`, `students`, `tenants`, transport allocation tables, and optional reconciliation/audit tables (064-rollback-void-charges)
- Backend PHP 8.1+; Frontend TypeScript with React 18 + CodeIgniter 4, MySQL, React, Vite, TailwindCSS, shadcn/ui, TanStack React Query, React Hook Form, Zod (065-student-identity-layer)
- MySQL tenant-scoped tables using immutable migrations (065-student-identity-layer)
- PHP 8.1 · TypeScript (strict mode) + CodeIgniter 4 · React 18 · TanStack React Query v5 · TailwindCSS · shadcn/ui (066-performance-scalability-optimization)
- PHP 8.1+ · CodeIgniter 4 (backend) / TypeScript · React 18 · Vite (frontend) + CodeIgniter 4 ORM / TanStack React Query · shadcn/ui · TailwindCSS (067-staff-attendance-tracking)
- MySQL — existing `staff`, `staff_attendance`, `leave_requests` tables; `tenants.settings` JSON for work-hours config (067-staff-attendance-tracking)
- PHP 8.1+ · TypeScript 5 + CodeIgniter 4 (backend) · React 18 + TanStack Query + shadcn/ui (frontend) (068-student-attendance-classes)
- MySQL — new `student_attendance_events` table; existing `class_instances`, `enrollments`, `students`, `settings` tables referenced (068-student-attendance-classes)
- PHP 8.1+ (backend), TypeScript 5+ (frontend) + CodeIgniter 4 (backend), React 18 + TanStack Query (frontend), MySQL (database) (069-dashboard-data-aggregation)
- MySQL with pre-aggregated metrics tables (069-dashboard-data-aggregation)
- PHP 8.1+ (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 · MySQL · TanStack React Query · TailwindCSS · shadcn/ui (070-fix-dashboard-kpis)
- MySQL — existing tables: `students`, `charges`, `payments`, `classes`, `staff`, `staff_attendance`, `leave_requests`, `transport_routes`, `transport_student_allocations`, `enrollments`, `ledger_adjustments`, `tenants` (070-fix-dashboard-kpis)
- PHP 8.1+ backend; TypeScript 5 / React 18 frontend + CodeIgniter 4 REST API; MySQL; Paynow integration; React Query; Vite; TailwindCSS; shadcn/ui (071-subscription-cycle-rules)
- MySQL tables already present for `school_subscriptions`, `subscription_plans`, `subscription_transactions`, `proration_calculations`, `subscription_credits`, `subscription_invoices`, and `billing_events` (071-subscription-cycle-rules)
- TypeScript 5.x + React 18, TanStack React Query v5 (`@tanstack/react-query`), Lucide React (icons), shadcn/ui (Button), TailwindCSS (072-navbar-data-refresh)
- N/A — no database changes (072-navbar-data-refresh)
- PHP 8.1+ backend; TypeScript/React 18 frontend + CodeIgniter 4 REST API, MySQL, React Query, Axios API client, Vite frontend (073-backend-payments-pagination)
- MySQL tables for payments, students, classes, payment categories, fee campaigns, ledger source records (073-backend-payments-pagination)
- PHP 8.1+ backend; TypeScript with React 18 frontend + CodeIgniter 4 REST API, MySQL, Axios API client, TanStack React Query, Vite, TailwindCSS, shadcn/ui (074-backend-data-optimization)
- MySQL tenant-scoped operational data for students, classes, enrollments, staff attendance, student class attendance, charges, payments, and ledger adjustments (074-backend-data-optimization)
- PHP 8.1+ backend; React 18 + TypeScript frontend + CodeIgniter 4, MySQL, JWT auth, React Router, TanStack React Query, React Hook Form, Zod, TailwindCSS, shadcn/ui (076-onboarding-guided-tutorial)
- MySQL tables for onboarding progress, tenant-scoped setup guide progress, and per-user tutorial progress; existing tenant/user tables for profile/contact fields (076-onboarding-guided-tutorial)
- PHP 8.1 (backend) · TypeScript 5 / React 18 (frontend) + CodeIgniter 4 · MySQL (backend); TanStack React Query · React Hook Form · shadcn/ui · TailwindCSS (frontend) (077-bulk-student-import)
- MySQL — existing `students` table; no new tables (077-bulk-student-import)
- PHP 8.1+ (backend) · TypeScript / React 18 (frontend) + CodeIgniter 4 (backend) · TanStack React Query · shadcn/ui · TailwindCSS · Lucide icons (079-subscriptions-ops-dashboard)
- MySQL — tables: `school_subscriptions`, `subscription_plans`, `subscription_payment_transactions`, `subscription_invoices`, `tenants` (079-subscriptions-ops-dashboard)
- PHP 8.1+ backend, TypeScript/React 18 frontend + CodeIgniter 4, React Query, Recharts, shadcn/ui, TailwindCSS (080-finance-control-center)
- PHP 8.1+ backend, TypeScript/React 18 frontend + CodeIgniter 4, MySQL, React Query, Vite, shadcn/ui, Recharts (081-backend-analytics)
- PHP 8.1+ (backend) · TypeScript 5.x / React 18 (frontend) + CodeIgniter 4 (backend) · TanStack React Query v5 · shadcn/ui · TailwindCSS (084-backend-driven-architecture)
- MySQL — `staff`, `fee_campaigns`, `campaign_students`, `transport_routes`, `transport_vehicles`, `transport_drivers` tables (084-backend-driven-architecture)
- PHP 8.1+ · CodeIgniter 4 + MySQL, JWTAuthFilter, BaseApiController (085-receipt-search-cancel)
- MySQL (existing `payments` table with `receipt_number`, `voided_at`, `void_reason`, `voided_by`) (085-receipt-search-cancel)
- PHP 8.1+ (backend), TypeScript/React 18 (frontend) + CodeIgniter 4, MySQL, TanStack React Query, shadcn/ui, TailwindCSS (086-fee-campaign-payment-modal)
- MySQL — existing `fee_campaigns`, `campaign_students`, `payments` tables (086-fee-campaign-payment-modal)

- PHP 8.1+ + CodeIgniter 4, MySQL 8.0+ (007-fix-payment-bugs)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for PHP 8.1+

## Code Style

PHP 8.1+: Follow standard conventions

## Recent Changes
- 086-fee-campaign-payment-modal: Added PHP 8.1+ (backend), TypeScript/React 18 (frontend) + CodeIgniter 4, MySQL, TanStack React Query, shadcn/ui, TailwindCSS
- 085-receipt-search-cancel: Added PHP 8.1+ · CodeIgniter 4 + MySQL, JWTAuthFilter, BaseApiController
- 084-backend-driven-architecture: Added PHP 8.1+ (backend) · TypeScript 5.x / React 18 (frontend) + CodeIgniter 4 (backend) · TanStack React Query v5 · shadcn/ui · TailwindCSS


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
