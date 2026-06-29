# Implementation Plan: Campaign Receipt & Payments Integration

**Branch**: `062-campaign-receipt-payments` | **Date**: 2026-05-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/062-campaign-receipt-payments/spec.md`

## Summary

Enhance the existing fee campaign module (feature 059) with three capabilities: (1) manual student addition to an active campaign with full validation, (2) automatic receipt number + immutable transaction snapshot generation for every campaign payment, and (3) guaranteed visibility of campaign payments on the main payments page with campaign name as the source label. No new database tables are required — changes are additive modifications to `FeeCampaignService`, `ReceiptController`, and the frontend payments page.

**Technical approach**: Extend `FeeCampaignService::recordPayment()` to populate `snapshot` JSON and confirm `receipt_number` uses the same `BaseApiController::generateReceiptNumber()` format. Verify `GET /api/payments` already surfaces campaign payments (it does — `PaymentModel::getByTenant` is unfiltered on `fee_campaign_id`). Extend `ReceiptController::show()` to render campaign-specific receipt fields from the snapshot. Add integration tests covering the three user stories + curl-runnable quickstart.

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: CodeIgniter 4 (backend), React 18 + TanStack Query + shadcn/ui + TailwindCSS (frontend)
**Storage**: MySQL (existing database — no new tables)
**Testing**: CodeIgniter integration tests in `backend/tests/Integration/` + curl scripts in `quickstart.md`
**Target Platform**: Web (SPA + REST API, `localhost:8080`)
**Project Type**: Web application (multi-tenant SaaS) — enhancement, not greenfield
**Performance Goals**: Snapshot capture adds < 5ms overhead to payment recording (one JSON encode, no extra DB round-trip)
**Constraints**: Campaign payments MUST NOT affect `LedgerService` balance calculations (existing `fee_campaign_id IS NULL` filter covers this); snapshot must be stored in same transaction as payment insert
**Scale/Scope**: ~2 backend files modified, ~1 test file extended — no new files strictly required; optional receipt UI tweak for campaign label

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | All campaign and payment queries filter by JWT-sourced `tenant_id`. New `addStudent` path verifies `students.tenant_id` matches. |
| II | API-First Separation | ✅ PASS | All logic in service layer; frontend consumes existing REST API. No DB access from frontend. |
| III | JWT Auth & Role-Based Access | ✅ PASS | `addStudent` and `recordPayment` endpoints already enforce `requireRole('super_admin','admin','bursar')`. Receipt endpoint is intentionally public (QR code access). |
| IV | Immutable Migrations | ✅ PASS | No schema changes needed — `payments.snapshot`, `payments.receipt_number`, and `payments.fee_campaign_id` columns already exist from features 057 and 059. |
| V | Financial Ledger Integrity | ✅ PASS | `LedgerService` excludes `fee_campaign_id IS NOT NULL` payments from all five balance calculation sites. Snapshot captures campaign-specific balance, not ledger balance. |
| VI | REST API Standards | ✅ PASS | No new routes added. All modified endpoints use `respondSuccess` / `respondError` via `BaseApiController`. |
| VII | Code Quality | ✅ PASS | Snapshot assembly follows identical pattern to `PaymentController` system-category path. No duplication introduced. |
| VIII | Defensive Security | ✅ PASS | Snapshot data sourced from DB records (campaign name, student name) — not from user input. All existing input validation retained. |
| IX | Error Handling | ✅ PASS | Transaction rollback on any failure. Snapshot failure is caught inside the existing `transStart/transComplete` block. |
| X | Integration Testing | ✅ PASS | New test cases added to `FeeCampaignTest.php` covering: snapshot contents, receipt retrieval, payments page visibility, tenant isolation, and error paths. |
| XI | Performance Discipline | ✅ PASS | Snapshot is one `json_encode` call inside the existing transaction. No extra queries added. |

**Gate result**: ALL 11 PRINCIPLES PASS — proceed to Phase 0.

**Post-design re-check**: All principles still pass after Phase 1 design. No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/062-campaign-receipt-payments/
├── plan.md              # This file
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: schema design (no new tables)
├── quickstart.md        # Phase 1: dev setup + curl tests
├── contracts/           # Phase 1: API contracts
│   └── campaign-receipt-payments.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (all pass)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Services/
│   │   └── FeeCampaignService.php          (MODIFY: add snapshot to recordPayment)
│   ├── Controllers/Api/
│   │   └── ReceiptController.php           (MODIFY: campaign-aware receipt rendering)
│   └── Config/
│       └── Routes.php                      (NO CHANGE: all routes already exist)
└── tests/
    └── Integration/
        └── FeeCampaignTest.php             (MODIFY: add 7 new test cases for feature 062)

frontend/
└── src/
    ├── types/
    │   └── dashboard.ts                    (MODIFY: add campaignName to Payment type)
    └── pages/
        └── Payments.tsx                    (MODIFY: display campaignName label if feeCampaignId set)
```

**Structure Decision**: Web application layout. This is a pure enhancement — no new files needed on the backend. The existing `FeeCampaignController`, `FeeCampaignService`, and `PaymentModel` are extended in-place following the established Controller → Service → Model pattern.

## Complexity Tracking

> No constitution violations — table is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
