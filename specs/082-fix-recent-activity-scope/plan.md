# Implementation Plan: Fix Recent Activity Scope Isolation

**Branch**: `082-fix-recent-activity-scope` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/082-fix-recent-activity-scope/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This feature resolves data leakage and feed starvation bugs in the Recent Activity sections of the Control Panel and Tenant dashboards. The platform dashboard will be filtered to exclusively display `platform.*` action events. The tenant dashboard will be expanded from a payments-only query to a multi-source backend aggregation of payments, enrollments, student status changes, and staff leave approvals, strictly scoped to the tenant ID from the authenticated JWT.

## Technical Context

**Language/Version**: PHP 8.1+, React 18, TypeScript  
**Primary Dependencies**: CodeIgniter 4, React Query, Axios  
**Storage**: MySQL  
**Testing**: PHPUnit, Curl API validation  
**Target Platform**: Web Browsers  
**Project Type**: Web Application (SaaS)  
**Performance Goals**: API response <500ms, O(1) multi-source query performance (via query pushdown and limit)  
**Constraints**: Zero schema migrations allowed. Backend must perform all aggregation and sorting.  
**Scale/Scope**: 100k+ records per tenant, <10 items returned per feed request  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Backend-Driven Data**: YES. The tenant feed aggregation, cross-entity selection, limiting, and sorting will be exclusively handled by the `Api\DashboardController` using CodeIgniter Query Builder. The frontend will only consume the combined feed.
- **Query Efficiency**: YES. We will fetch the top `N` records per table (using index on `tenant_id` and `created_at`/`date`), then merge and take the top `N` in PHP. This avoids complex UNIONs and bounds the memory usage to `4 * N` rows max.
- **Loading States**: YES. `useDashboardStats` and the `ActivityFeed` component already map `isLoading` flags. No mutations are introduced in this read-only fix.
- **Email Design**: N/A. No emails sent.

## Project Structure

### Documentation (this feature)

```text
specs/082-fix-recent-activity-scope/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── activity-feed-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/
│   │   ├── Api/
│   │   │   └── DashboardController.php
│   │   └── Platform/
│   │       └── DashboardController.php

frontend/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   └── ActivityFeed.tsx
│   ├── hooks/
│   │   └── useDashboardStats.ts
```

**Structure Decision**: The fix touches the two backend `DashboardController` files and slightly adjusts the frontend `ActivityFeed` UI/hooks to support the new unified types.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*(No violations)*
