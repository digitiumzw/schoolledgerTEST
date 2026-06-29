# SchoolLedger Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-06-25

## Active Technologies
- TypeScript 5.x, React 18, Vite + React 18, TailwindCSS, shadcn/ui, TanStack React Query (existing auth context), React Router DOM (existing), Lucide React (existing icons) (088-role-based-help-page)
- N/A — help content is static TypeScript data artifacts, not persisted in a database (088-role-based-help-page)
- PHP 8.1+ (Backend), TypeScript 5.x / React 18 (Frontend) + CodeIgniter 4 (MVC Web Framework), TailwindCSS, TanStack React Query, Axios (089-platform-production-readiness)
- MySQL 8.0+ (InnoDB Engine) supporting transactional isolation, composite indexing, and advisory locking (089-platform-production-readiness)
- PHP 8.1+ / CodeIgniter 4 / MySQL + dompdf/dompdf (already installed via composer), React 18 / TypeScript / Vite / TanStack Query (090-generate-payment-report)
- MySQL (existing charges, payments, ledger_adjustments, students, classes, tenants tables). PDFs are generated in-memory; no new tables or schema changes required. (090-generate-payment-report)
- PHP 8.1+ (backend), TypeScript / React 18 (frontend) + CodeIgniter 4, MySQL, React Router, TanStack React Query, TailwindCSS, shadcn/ui (091-platform-maintenance-mode)
- MySQL — `platform_settings` table (existing key-value store with JSON value column and type ENUM) (091-platform-maintenance-mode)
- PHP 8.1+ (backend), TypeScript / React 18 (frontend) + CodeIgniter 4, MySQL (backend); Vite, TanStack React Query, TailwindCSS, shadcn/ui (frontend) (092-parent-receipt-list)
- MySQL — existing `payments` table, `students` table, `classes` table (092-parent-receipt-list)

- PHP 8.1+ · CodeIgniter 4 · MySQL + React 18 · TypeScript · Vite · TailwindCSS · shadcn/ui · TanStack React Query (087-route-balance-printing)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for PHP 8.1+ · CodeIgniter 4 · MySQL

## Code Style

PHP 8.1+ · CodeIgniter 4 · MySQL: Follow standard conventions

## Recent Changes
- 092-parent-receipt-list: Added PHP 8.1+ (backend), TypeScript / React 18 (frontend) + CodeIgniter 4, MySQL (backend); Vite, TanStack React Query, TailwindCSS, shadcn/ui (frontend)
- 091-platform-maintenance-mode: Added PHP 8.1+ (backend), TypeScript / React 18 (frontend) + CodeIgniter 4, MySQL, React Router, TanStack React Query, TailwindCSS, shadcn/ui
- 090-generate-payment-report: Added PHP 8.1+ / CodeIgniter 4 / MySQL + dompdf/dompdf (already installed via composer), React 18 / TypeScript / Vite / TanStack Query


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
