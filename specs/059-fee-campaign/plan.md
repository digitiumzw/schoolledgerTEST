# Implementation Plan: Fee Campaign

**Branch**: `059-fee-campaign` | **Date**: 2026-05-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/059-fee-campaign/spec.md`

## Summary

Implement a standalone fee campaign module that allows schools to create event-based fee collection initiatives (e.g., Grade 7 exam fees) targeting specific student groups. The system auto-assigns eligible students at creation time, tracks individual payment progress (unpaid → partially_paid → fully_paid), and records campaign payments in the general payments table with a campaign reference — all while keeping campaign balances completely isolated from the standard charge-based ledger.

**Technical approach**: Two new database tables (`fee_campaigns`, `campaign_students`) plus an additive FK column on `payments`. A thin `FeeCampaignController` delegates business logic to `FeeCampaignService`. Frontend adds a new `/fee-campaigns` page with list + detail views and a "Fee Campaigns" card on the student profile.

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript 5.x (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend), React 18 + TanStack Query + shadcn/ui + TailwindCSS (frontend)  
**Storage**: MySQL (existing database)  
**Testing**: CodeIgniter integration tests in `backend/tests/`  
**Target Platform**: Web (SPA + REST API)  
**Project Type**: Web application (multi-tenant SaaS)  
**Performance Goals**: Auto-assign up to 500 students in < 5 seconds (SC-001)  
**Constraints**: Campaign payments must not affect standard ledger balances (FR-019)  
**Scale/Scope**: ~5 new backend files, ~8 new frontend files, 2 new DB tables + 1 additive column

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | `fee_campaigns` and `campaign_students` both have `tenant_id` column; all queries filter by JWT-sourced `tenant_id`. |
| II | API-First Separation | ✅ PASS | All campaign logic lives in backend controllers/services; frontend consumes REST API only. |
| III | JWT Auth & Role-Based Access | ✅ PASS | All `/api/fee-campaigns/*` routes go through `JWTAuthFilter`; controller enforces admin/bursar role. |
| IV | Immutable Migrations | ✅ PASS | Two new migration files; no edits to existing migrations. One additive column on `payments`. |
| V | Financial Ledger Integrity | ✅ PASS | Campaign payments do NOT enter the charges table. Standard `SUM(charges) - SUM(payments)` balance formula is unchanged. Campaign-linked payments are excluded from ledger balance by the `fee_campaign_id IS NULL` filter (additive, backward-compatible). |
| VI | REST API Standards | ✅ PASS | Endpoints follow kebab-case plural nouns (`/api/fee-campaigns`). All responses use `success()`/`error()` helpers. |
| VII | Code Quality | ✅ PASS | Service layer handles business logic; controller is thin. No duplication with existing billing code — campaign is a separate parallel module. |
| VIII | Defensive Security | ✅ PASS | All inputs validated and sanitized. No secrets in source. Overpayment guard (FR-010). |
| IX | Error Handling | ✅ PASS | Explicit error responses for every validation path. No internal details exposed. |
| X | Integration Testing | ✅ PASS | Integration test file covers: campaign CRUD, auto-assign, payment recording, overpayment rejection, status transitions, tenant isolation, closed-campaign guard. |
| XI | Performance Discipline | ✅ PASS | Bulk INSERT for auto-assignment (batch, not N individual queries). Aggregate queries use SUM with GROUP BY, not N+1 loops. |

**Gate result**: ALL 11 PRINCIPLES PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/059-fee-campaign/
├── plan.md              # This file
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: schema design
├── quickstart.md        # Phase 1: dev setup
├── contracts/           # Phase 1: API contracts
│   ├── fee-campaigns.md
│   └── student-campaigns.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Database/Migrations/
│   │   ├── 2026-05-04-100001_Create_fee_campaigns_table.php
│   │   ├── 2026-05-04-100002_Create_campaign_students_table.php
│   │   └── 2026-05-04-100003_Add_fee_campaign_id_to_payments.php
│   ├── Models/
│   │   ├── FeeCampaignModel.php
│   │   └── CampaignStudentModel.php
│   ├── Services/
│   │   └── FeeCampaignService.php
│   ├── Controllers/Api/
│   │   └── FeeCampaignController.php
│   └── Config/
│       └── Routes.php  (additive: fee-campaigns route block)
└── tests/
    └── Integration/
        └── FeeCampaignTest.php

frontend/
└── src/
    ├── api/
    │   └── api.ts  (additive: campaign interfaces + API stubs)
    ├── pages/
    │   ├── FeeCampaigns.tsx          (campaign list page)
    │   └── FeeCampaignDetail.tsx     (campaign detail + student list)
    ├── components/
    │   ├── modals/
    │   │   ├── CreateCampaignModal.tsx
    │   │   └── CampaignPaymentModal.tsx
    │   └── student-profile/
    │       └── StudentCampaignsCard.tsx
    ├── hooks/
    │   └── useFeeCampaigns.ts
    └── types/
        └── dashboard.ts  (additive: campaign types)
```

**Structure Decision**: Web application layout (Option 2). All new files follow existing project conventions. Backend uses the established Controller → Service → Model pattern. Frontend follows React + TanStack Query + shadcn/ui conventions.

## Complexity Tracking

> No constitution violations — table is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
