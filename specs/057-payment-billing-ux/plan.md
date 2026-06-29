# Implementation Plan: Payment & Billing UX Improvements

**Branch**: `057-payment-billing-ux` | **Date**: 2026-05-04 | **Spec**: `specs/057-payment-billing-ux/spec.md`  
**Input**: Feature specification from `specs/057-payment-billing-ux/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Five UX improvements to the payment and billing workflow: (1) surface an alert on the Payments page when fee-rule charges have not been generated for the current billing period; (2) allow fee rules to target multiple classes simultaneously; (3) formalise three system payment categories (`Fees`, `Transport`, `Transport + Fees`) as non-editable constants and display them distinctly from user-defined categories; (4) generate a human-readable receipt number in `YYYY.MM.DD.HHmmss.X` format on every payment; (5) store a point-in-time snapshot of student/class data with each payment so historical receipts remain accurate after class renames.

Backend approach: two additive `payments` columns (`receipt_number`, `snapshot`), one column-type migration on `fee_rules.assignment_scope_id` (TEXT), a new system-categories constant, and targeted changes to `PaymentController`, `ReceiptController`, `SettingsController`, `FeeRuleController`, `FeeRuleModel`, and `FeeRuleBillingService`. Frontend approach: multi-select class picker in `FeeRuleModal`, class-name resolution in `FeeRulesPanel`, unbilled-alert banner on the Payments page, system-category lock UI in `PaymentCategoriesTab`, and receipt number display.

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript 5 / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend) · Vite + React Query + shadcn/ui + TailwindCSS (frontend)  
**Storage**: MySQL 5.7.8+ / MariaDB 10.2.7+ (JSON column support required for `snapshot`)  
**Testing**: CodeIgniter `spark test` (PHPUnit) · Bun type-check + ESLint (frontend)  
**Target Platform**: Linux server (backend API) · Web browser SPA (frontend)  
**Project Type**: Web application (full-stack, separate `backend/` + `frontend/` trees)  
**Performance Goals**: Payment creation remains < 300 ms p95 (one extra DB read for snapshot — inside existing transaction)  
**Constraints**: Snapshot must be populated atomically with the payment insert; legacy rows without snapshot must not break receipt rendering  
**Scale/Scope**: Per-tenant; schools up to ~2 000 students; fee-rule scope change is a write-time cost only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Multi-Tenant Data Isolation | **PASS** | All new queries include `tenant_id` guard. Snapshot is written inside the JWT-authenticated payment transaction. System categories are tenant-scoped (injected with `tenantId` in response). |
| II | API-First Separation of Concerns | **PASS** | No business logic in controllers beyond orchestration. Snapshot assembly and receipt-number generation are co-located in `PaymentController::create()` (thin enough); heavy logic stays in `LedgerService`. |
| III | JWT Authentication & Role-Based Access | **PASS** | `GET /api/receipts/:id` is and remains public (receipt sharing use-case). All mutating endpoints require JWT + role. System-category guards added to `SettingsController`. |
| IV | Immutable Migrations | **PASS** | Two new forward-only migrations with idempotent guards. `down()` methods restore schema. No existing migration is modified. |
| V | Financial Ledger Integrity | **PASS** | Snapshot and `balance_after_payment` are written inside the same DB transaction as the payment insert. `LedgerService::allocatePaymentToCharges` is called before committing. No stored balance is used for live calculations. |
| VI | REST API Standards & Consistent Responses | **PASS** | All responses use existing `success/data/error` envelope. New fields are additive. `receiptNumber` and `snapshot` are nullable for backward compat. |
| VII | Code Quality & Maintainability | **PASS** | System categories extracted to a dedicated constant (`PaymentCategories.php` / `paymentCategories.ts`). Multi-class scope handled by a single `decodeScopeId()` helper in `FeeRuleModel`. |
| VIII | Defensive Security | **PASS** | System category names rejected on create/update/delete (case-insensitive). `assignmentScopeId` array elements are individually sanitised. Snapshot fields are pulled from DB rows, not from user input. |
| IX | Error Handling & Observability | **PASS** | Transaction failure in `PaymentController::create()` rolls back snapshot + payment atomically. Errors logged via `log_message`. 403 returned for system-category violations. |
| X | Integration Testing | **PASS** | New test class `PaymentBillingUxTest.php` required covering: receipt number format, snapshot persistence, snapshot class-name override on receipt, system category injection + guard, multi-class billing eligibility. |
| XI | Performance Discipline | **PASS** | Snapshot requires one extra `students` + `classes` DB read at payment time — acceptable inside an existing transaction. No N+1 risk added. Multi-class `whereIn` on `class_id` uses existing index. |

*Post-design re-check: all 11 principles PASS.*

## Project Structure

### Documentation (this feature)

```text
specs/057-payment-billing-ux/
├── plan.md              # This file
├── research.md          # Phase 0 output — 7 decisions resolved
├── data-model.md        # Phase 1 output — 2 migrations + model/type changes
├── quickstart.md        # Phase 1 output — dev setup + smoke tests
├── contracts/
│   ├── payments.md              # POST /api/payments + GET /api/receipts/:id
│   ├── fee-rules.md             # POST/PUT /api/fee-rules (multi-class scope)
│   └── payment-categories.md   # GET/POST/PUT/DELETE with system category guards
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── PaymentCategories.php          # NEW — system categories constant
│   ├── Controllers/Api/
│   │   ├── PaymentController.php          # MODIFIED — receipt number + snapshot
│   │   ├── ReceiptController.php          # MODIFIED — prefer snapshot.className
│   │   ├── SettingsController.php         # MODIFIED — system category injection + guards
│   │   └── FeeRuleController.php          # MODIFIED — multi-class scope array support
│   ├── Database/Migrations/
│   │   ├── 2026-05-04-000001_Add_receipt_number_and_snapshot_to_payments.php  # NEW
│   │   └── 2026-05-04-000002_Widen_fee_rule_scope_id_to_text.php              # NEW
│   ├── Models/
│   │   ├── PaymentModel.php               # MODIFIED — allowedFields + formatForApi
│   │   └── FeeRuleModel.php               # MODIFIED — buildScopeLabel + decodeScopeId
│   └── Services/
│       └── FeeRuleBillingService.php      # MODIFIED — multi-class getEligibleStudents
└── tests/Integration/
    └── PaymentBillingUxTest.php           # NEW

frontend/
└── src/
    ├── api/
    │   └── api.ts                         # MODIFIED — FeeRule, Payment, PaymentSnapshot types
    ├── components/
    │   ├── modals/
    │   │   ├── RecordPaymentModal.tsx      # MODIFIED — remove hard-coded TRANSPORT_CATEGORIES
    │   │   └── FeeRuleModal.tsx            # MODIFIED — multi-select class picker
    │   └── settings/
    │       ├── FeeRulesPanel.tsx           # MODIFIED — class name resolution in scope column
    │       └── PaymentCategoriesTab.tsx    # MODIFIED — lock/badge for system categories
    ├── constants/
    │   └── paymentCategories.ts           # NEW — system categories constant
    └── pages/
        └── Payments.tsx (or equivalent)   # MODIFIED — unbilled charges alert banner
```

**Structure Decision**: Web application layout — separate `backend/` (CodeIgniter 4 PHP) and `frontend/` (React + Vite) trees. No new top-level directories. All changes are additive or targeted modifications to existing files, plus two new migration files and one new backend Config file.

## Complexity Tracking

No Constitution Check violations require justification. All 11 principles pass without exceptions.
