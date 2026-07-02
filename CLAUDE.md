# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SchoolLedger is a full-stack, multi-tenant SaaS school management system. The repo is a monorepo with two independent apps:

- `frontend/` — React 18 + TypeScript SPA (Vite, TailwindCSS, shadcn/ui, React Query)
- `backend/` — CodeIgniter 4 REST API (PHP 8.1+, JWT auth, MySQL)

## Commands

### Frontend (`frontend/`)
```bash
npm run dev       # Start Vite dev server on port 8080
npm run build     # Production build to dist/
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

### Backend (`backend/`)
```bash
php spark serve           # Start dev server on port 8080
php spark migrate         # Run all pending migrations
composer install          # Install PHP dependencies
```

Default dev credentials: `admin@greenwood.co.zw` / `12345678`

## Architecture

### Frontend

**Routing & providers** are all wired in `src/App.tsx`. The auth flow runs through `src/contexts/AuthContext.tsx` — it stores JWT in `localStorage` under key `schoolledger_token` and exposes `user`, `tenant`, `login`, and `logout`.

**API layer** (`src/api/api.ts`) points to `http://localhost:8080/api`. All requests attach the JWT via `Authorization: Bearer <token>`.

**Server state** is managed exclusively with TanStack React Query. Component local state uses `useState`. There is no Redux or Zustand.

**Data handling** is backend-driven. Frontend components may pass query parameters and render API responses, but must not perform client-side filtering, searching, sorting, pagination, aggregations, ledger/statistical calculations, or business data reshaping.

**Mutation loading states** are mandatory. Every create/update/delete/submit/refresh action MUST show a visible loading indicator (spinner, skeleton, or disabled-with-loader) from the moment the request is initiated until the response is received and the UI reflects the confirmed server state. Action-triggering controls (buttons, forms) MUST be disabled during in-flight requests to prevent duplicate submissions. After each mutation, all affected React Query caches MUST be invalidated via `queryClient.invalidateQueries` or updated via `queryClient.setQueryData` so no stale data flashes. Every custom hook wrapping a mutation MUST expose `isPending` (or equivalent) for calling components to wire directly to loading UI.

**Forms** use React Hook Form + Zod for validation.

**Page components** live in `src/pages/`. Reusable UI primitives are in `src/components/ui/` (shadcn/ui base). Feature-level components (e.g., `src/components/settings/`, `src/components/staff-attendance/`) are co-located with their pages.

**Custom hooks** in `src/hooks/` encapsulate business logic (e.g., `useFeeStructure`, `useChargeGeneration`). Prefer extracting complex logic to hooks rather than keeping it in page components.

### Backend

**All routes** are declared in `app/Config/Routes.php`. Every endpoint under `/api/*` (except `/auth/login`, `/auth/register`, and `/api/receipts/:id`) passes through:
1. `CorsFilter` — handles preflight and CORS headers
2. `JWTAuthFilter` — validates the Bearer token; attaches decoded payload to request

`/api/receipts/:id` is intentionally public (no JWT) so QR codes on printed receipts work for parents/guardians without an account. Add new public paths to the exclusion list in `JWTAuthFilter`.

**Controllers** live in `app/Controllers/Api/` and extend `BaseApiController`, which provides standardized JSON response helpers (`respondSuccess`, `respondError`, etc.).

**Multi-tenancy** is enforced by filtering all queries with `tenant_id`. The `tenant_id` comes from the decoded JWT payload and must be included in every data-access query.

**Data preparation** belongs in backend controllers/services/models. APIs should return minimal view-ready payloads with server-side pagination metadata, applied filters, sort metadata, and precomputed summaries where needed. Avoid N+1 queries through joins, subqueries, batching/eager loading, indexes, caching, or pre-aggregation as appropriate.

**JWT handling** is in `app/Libraries/JWTHandler.php`. Configuration is in `app/Config/Jwt.php`. The secret key is set in `.env` as `JWT_SECRET_KEY`.

**Database migrations** are in `app/Database/Migrations/`. Always create a new migration file for schema changes — never edit existing ones.

**Email templates** MUST follow the established design system. All email views should reuse existing email layout components, CSS classes, and styling patterns. New email types must extend the base email template system rather than implementing independent layouts. Maintain consistent header/footer structure, brand colors, typography hierarchy, button styling, and responsive behavior across all email communications.

### Data Flow: Financial Ledger

The billing model has two distinct concepts:
- **Charges** (`charges` table) — fees levied against students for a given `term_id`. Generated in bulk via `POST /api/charges/generate`.
- **Payments** (`payments` table) — individual payment transactions recorded against a student.
- **Balance** — computed as `SUM(charges) - SUM(payments)` via `LedgerController` / `StudentModel::getBalance()`.

The `getAllBalances()` optimization uses a single subquery instead of N queries per student — preserve this pattern when touching ledger queries.

`payments.balance_after_payment` (DECIMAL 12,2, nullable) stores a snapshot of the student's outstanding balance immediately after a payment is recorded. It is `null` for payments created before migration `2026-04-26-000001`. Do not compute this field from live ledger data at read time — it must be written atomically alongside the payment insert.

Accepted payment methods: `Cash`, `EcoCash`, `OneMoney`, `Telecash`, `Bank Transfer`, `ZIPIT`, `Swipe`, `Cheque`, `Other`.

### Role-Based Access

JWT token payload contains `role`. Roles: `super_admin`, `admin`, `teacher`, `bursar`. Frontend enforces access via `<ProtectedRoute>` in `App.tsx`. Backend enforces at the controller level.

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/Config/Routes.php` | All API endpoint definitions |
| `backend/app/Config/Filters.php` | Middleware (CORS, JWT) configuration |
| `backend/app/Filters/JWTAuthFilter.php` | JWT validation; public-path exclusion list |
| `backend/app/Controllers/Api/BaseApiController.php` | Shared response helpers |
| `backend/app/Controllers/Api/ReceiptController.php` | Public receipt endpoint (`GET /api/receipts/:id`) |
| `frontend/src/App.tsx` | React routing, providers, protected routes |
| `frontend/src/api/api.ts` | Axios instance and all API call functions |
| `frontend/src/contexts/AuthContext.tsx` | Global auth state |
| `frontend/src/components/receipt/ReceiptDocument.tsx` | Printable receipt component (QR code, balance snapshot) |
| `frontend/.env` / `backend/.env` | Environment-specific config (not committed) |

## Environment Setup

Backend `.env` (in `backend/`):
```
CI_ENVIRONMENT = development
JWT_SECRET_KEY = <secret>
database.default.hostname = localhost
database.default.database = schoolledger
database.default.username = <user>
database.default.password = <pass>
```

Frontend API base URL is hardcoded in `src/api/api.ts` as `http://localhost:8080/api`. Change this for different environments.

## Recent Changes
- 094-multicurrency-support: Multi-currency financial system — new exchange_rates table, CurrencyService, CurrencyController, additive currency columns on charges/payments, exchange rate management UI, multi-currency payment/charge recording, reporting currency support. PHP 8.1+ / CodeIgniter 4 / MySQL (backend) · React 18 / TypeScript / TanStack React Query / shadcn/ui (frontend)
- 093-print-student-profile: Added PHP 8.1+ (backend, unchanged) · TypeScript 5.x / React 18 (frontend, primary surface) + CodeIgniter 4, MySQL (backend, unchanged) · Vite, TailwindCSS, shadcn/ui, TanStack React Query, lucide-react (frontend)
- 078-account-deletion-request: Added PHP 8.1+, React 18, TypeScript + CodeIgniter 4, MySQL, TanStack React Query, Axios, TailwindCSS, shadcn/ui
- 057-payment-billing-ux: Added PHP 8.1 (backend) · TypeScript 5 / React 18 (frontend) + CodeIgniter 4 (backend) · Vite + React Query + shadcn/ui + TailwindCSS (frontend)

## Active Technologies
- PHP 8.1+ (backend, unchanged) · TypeScript 5.x / React 18 (frontend, primary surface) + CodeIgniter 4, MySQL (backend, unchanged) · Vite, TailwindCSS, shadcn/ui, TanStack React Query, lucide-react (frontend) (094-multicurrency-support)
- MySQL — new exchange_rates table + additive nullable currency columns on charges/payments (094-multicurrency-support)
