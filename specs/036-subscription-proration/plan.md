# Implementation Plan: Subscription Proration for Mid-Cycle Upgrades

**Branch**: `036-subscription-proration` | **Date**: 2026-04-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/036-subscription-proration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement subscription plan proration that calculates unused value credits and prorated new plan charges when customers upgrade or downgrade mid-cycle. The system will display a breakdown before confirmation, process immediate payment for net amounts, and handle failed payments gracefully by reverting to the original plan.

## Technical Context

**Language/Version**: PHP 8.1+ · CodeIgniter 4 (backend), React 18 · TypeScript (frontend)  
**Primary Dependencies**: Existing PaynowService, InvoiceService, BillingEventService  
**Storage**: MySQL via CodeIgniter 4 Models  
**Testing**: PHPUnit (backend), existing test infrastructure  
**Target Platform**: Linux server (backend), Modern browsers (frontend)  
**Project Type**: Web application (backend + frontend SPA)  
**Performance Goals**: Proration calculation <100ms, Page load with breakdown <500ms  
**Constraints**: Must reuse existing subscription tables; all queries tenant-scoped  
**Scale/Scope**: Single-tenant proration calculations, max ~1K subscriptions per tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | All existing subscription queries use `tenant_id` from JWT. New proration feature will follow same pattern. |
| II. API-First Separation | ✅ PASS | Proration calculation/breakdown via API; frontend displays results. No DB access from frontend. |
| III. JWT Authentication | ✅ PASS | New endpoints will use existing `JWTAuthFilter` and `requireRole()` pattern. |
| IV. Immutable Migrations | ✅ PASS | New tables (`proration_calculations`, `subscription_credits`) via new migration files. |
| V. Financial Ledger Integrity | ✅ PASS | Subscription billing is separate from student ledger; proration follows existing transaction patterns. |

**Constitution Check Result**: ✅ **ALL GATES PASS** - Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/036-subscription-proration/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (SKIPPED - no clarifications needed)
├── data-model.md        # Phase 1 output (TO BE GENERATED)
├── quickstart.md        # Phase 1 output (TO BE GENERATED)
├── contracts/           # Phase 1 output (TO BE GENERATED)
│   ├── api-contract.md
│   └── frontend-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Structure Decision**: Web application (backend + frontend) per existing project layout.

```text
backend/
├── app/
│   ├── Config/Routes.php              # Add proration API routes
│   ├── Controllers/Api/
│   │   └── SubscriptionController.php  # Add proration endpoints
│   ├── Services/
│   │   └── ProrationService.php        # NEW: Proration calculation logic
│   ├── Models/
│   │   ├── SubscriptionCreditModel.php # NEW: Credit tracking
│   │   └── ProrationCalculationModel.php # NEW: Calculation audit
│   └── Database/Migrations/            # NEW migrations for proration tables
├── tests/
│   └── unit/
│       └── ProrationServiceTest.php    # Unit tests for calculation logic

frontend/
├── src/
│   ├── api/
│   │   └── subscriptionApi.ts         # Add proration API calls
│   ├── components/
│   │   └── subscription/
│   │       └── ProrationBreakdown.tsx  # NEW: Display breakdown UI
│   └── hooks/
│       └── useProration.ts            # NEW: Proration data hook
```

## Phase Status

### Phase 0: Research

**Status**: ✅ SKIPPED - No NEEDS CLARIFICATION markers in specification. All technical requirements are clear and the existing subscription system provides adequate foundation.

### Phase 1: Design & Contracts

**Status**: ✅ COMPLETE

**Generated Artifacts**:
- `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/036-subscription-proration/data-model.md` - Entity definitions for proration calculations and credits
- `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/036-subscription-proration/contracts/api-contract.md` - REST API contract
- `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/036-subscription-proration/contracts/frontend-contract.md` - React component/hook contracts
- `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/036-subscription-proration/quickstart.md` - Setup guide

### Phase 2: Tasks

**Status**: ✅ COMPLETE

**Generated**: `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/036-subscription-proration/tasks.md`

- 50 total tasks across 6 phases
- Organized by user story (US1, US2, US3)
- Parallel execution examples provided
- MVP scope: User Story 1 (P1) only for initial release
