# Implementation Plan: Fix Payment Module Bugs

**Branch**: `007-fix-payment-bugs` | **Date**: April 6, 2026 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-fix-payment-bugs/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Fix critical bugs in the payment module that prevent bursars from recording payments and viewing payment data. The primary issues are:
1. Null pointer exception when saving payments - `PaymentModel::formatForApi()` receives null after insert
2. Undefined array key "month" errors when viewing payment lists - legacy data missing month field

Technical approach: Add null-safety checks in PaymentController after payment insert, ensure formatForApi handles null gracefully, and derive month field from date for all payment records.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: PHP 8.1+  
**Primary Dependencies**: CodeIgniter 4, MySQL 8.0+  
**Storage**: MySQL database with multi-tenant schema (tenant_id scoping)  
**Testing**: Manual testing via API endpoints and frontend UI  
**Target Platform**: Linux server (backend API), modern browsers (frontend SPA)
**Project Type**: Web service (REST API backend + React frontend)  
**Performance Goals**: API responses <500ms, zero critical errors in logs  
**Constraints**: Must maintain backward compatibility with existing payment data, atomic transactions required  
**Scale/Scope**: Bug fix affecting 2 backend files (PaymentController.php, PaymentModel.php), no frontend changes needed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Multi-Tenant Data Isolation ✅
**Status**: COMPLIANT  
**Justification**: This is a bug fix to existing payment endpoints. All payment queries already filter by `tenant_id` from JWT payload via `BaseApiController::getTenantId()`. No new queries are being added that could violate tenant isolation.

### Principle II: API-First Separation of Concerns ✅
**Status**: COMPLIANT  
**Justification**: Bug fixes are confined to backend PaymentController and PaymentModel. No frontend changes required. API contract remains unchanged.

### Principle III: JWT Authentication & Role-Based Access ✅
**Status**: COMPLIANT  
**Justification**: No changes to authentication or authorization. Payment endpoints already protected by JWTAuthFilter. Role checks remain unchanged.

### Principle IV: Immutable Migrations ✅
**Status**: COMPLIANT  
**Justification**: No schema changes required. The month field already exists in the payments table. Bug fix only affects application logic for deriving month from date.

### Principle V: Financial Ledger Integrity ✅
**Status**: COMPLIANT  
**Justification**: Bug fixes do not alter ledger calculation logic. Student balance computation (`SUM(charges) - SUM(payments)`) remains unchanged. Only fixing payment record retrieval and formatting.

**Overall Gate Status**: ✅ PASS - All constitutional principles are satisfied. This is a pure bug fix with no architectural changes.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
├── app/
│   ├── Controllers/
│   │   └── Api/
│   │       └── PaymentController.php    # FIX: Add null check after insert (line 140-142)
│   └── Models/
│       └── PaymentModel.php              # FIX: Handle null in formatForApi (line 119-139)
└── writable/
    └── logs/                             # Error logs showing the bugs

frontend/
├── src/
│   ├── components/
│   │   └── modals/
│   │       └── RecordPaymentModal.tsx    # No changes needed
│   └── pages/
│       └── Payments.tsx                  # No changes needed
```

**Structure Decision**: Web application with separate backend (CodeIgniter 4 PHP) and frontend (React TypeScript). Bug fixes are isolated to backend payment handling logic. No frontend changes required since the API contract remains unchanged.
b
## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
