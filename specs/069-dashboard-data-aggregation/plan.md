# Implementation Plan: Dashboard Data Aggregation and Decision Support

**Branch**: `069-dashboard-data-aggregation` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/069-dashboard-data-aggregation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The dashboard module serves as a data aggregation and decision-support tier that provides role-based, tenant-scoped views of real-time and historical KPIs. The system uses pre-aggregated metrics computed through background jobs to ensure performance at scale, supporting drill-down navigation from high-level summaries to detailed records. Key requirements include role-based widget display (admin vs bursar), real-time KPI updates within 5 minutes, 5-second load times for datasets up to 50k records, and strict multi-tenant data isolation.

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript 5+ (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend), React 18 + TanStack Query (frontend), MySQL (database)  
**Storage**: MySQL with pre-aggregated metrics tables  
**Testing**: PHPUnit (backend), Jest + React Testing Library (frontend), curl integration tests  
**Target Platform**: Web application (Linux server hosting)  
**Project Type**: web-service  
**Performance Goals**: <5s dashboard load, <5min KPI refresh, 100 concurrent users/tenant, 95% cache hit ratio  
**Constraints**: Multi-tenant isolation, role-based access, no live joins on transactional tables  
**Scale/Scope**: 50,000+ records per tenant, 100+ concurrent users, real-time KPI aggregation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Constitution Compliance Assessment

**I. Multi-Tenant Data Isolation**: 
- All dashboard queries MUST include tenant_id filtering
- Role-based views prevent cross-role data leakage
- KPI aggregation scoped per tenant

**II. API-First Separation of Concerns**: 
- Frontend communicates exclusively through REST API
- Dashboard widgets consume API endpoints, not direct database access
- Backend handles all aggregation logic

**III. JWT Authentication & Role-Based Access**: 
- Dashboard endpoints protected by JWTAuthFilter
- Role enforcement for admin vs bursar widget visibility
- Frontend ProtectedRoute components mirror backend role checks

**IV. Immutable Migrations**: 
- New metrics tables will use migration files
- No edits to existing migrations
- Proper down() methods for reversibility

**V. Financial Ledger Integrity**: 
- Dashboard uses existing ledger balance calculations
- No denormalized balance columns introduced
- KPI metrics derived from source records

**VI. REST API Standards & Consistent Responses**: 
- Dashboard endpoints follow REST conventions (/api/dashboard/*)
- All responses use BaseApiController response helpers
- Consistent JSON envelope format maintained

**VII. Code Quality & Maintainability**: 
- Service layer for aggregation logic
- Reusable widget components
- No code duplication planned

**VIII. Defensive Security**: 
- All inputs validated and sanitized
- No secrets in frontend code
- Proper error handling without information leakage

**IX. Error Handling & Observability**: 
- Explicit error handling for aggregation failures
- Fallback to last known good data
- Proper logging for debugging

**X. API Endpoint Testing (via curl)**: 
- Integration tests will be run after implementation
- Happy path, error path, and tenant isolation tests planned
- Tests executed via curl URL requests only

**XI. Performance Discipline**: 
- Pre-aggregation prevents N+1 queries
- Caching strategy for KPI metrics
- Performance goals based on measurements, not speculation

## Project Structure

### Documentation (this feature)

```text
specs/069-dashboard-data-aggregation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Database/
│   │   └── Migrations/          # New metrics tables
│   ├── Models/                  # KPI metric models
│   ├── Services/                # Dashboard aggregation service
│   └── Controllers/Api/         # Dashboard API endpoints
└── tests/Integration/           # Dashboard integration tests

frontend/
├── src/
│   ├── api/                     # Dashboard API interfaces
│   ├── hooks/                   # Dashboard data hooks
│   ├── components/dashboard/    # Dashboard widget components
│   └── pages/Dashboard.tsx      # Main dashboard page
└── tests/                       # Frontend component tests
```

**Structure Decision**: Web application structure following existing SchoolLedger patterns. Backend adds new models, services, and controllers for dashboard aggregation. Frontend adds dashboard-specific components, hooks, and pages while maintaining API-first architecture.

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design completion*

### Updated Constitution Compliance Assessment

**I. Multi-Tenant Data Isolation**: ✅ COMPLIANT
- All dashboard tables include `tenant_id` with composite indexes
- KPI metrics scoped per tenant in aggregation service
- User preferences isolated by tenant and user
- No cross-tenant data access possible in any query

**II. API-First Separation of Concerns**: ✅ COMPLIANT  
- Dashboard API endpoints follow REST conventions
- Frontend components consume API exclusively
- Backend handles all aggregation and business logic
- No direct database access from frontend

**III. JWT Authentication & Role-Based Access**: ✅ COMPLIANT
- All dashboard endpoints protected by JWTAuthFilter
- Role-based widget filtering in dashboard service
- Frontend ProtectedRoute mirrors backend enforcement
- Admin-only refresh endpoint properly secured

**IV. Immutable Migrations**: ✅ COMPLIANT
- New dashboard tables use migration files
- Proper down() methods for all schema changes
- No edits to existing migrations planned
- Migration immutability preserved

**V. Financial Ledger Integrity**: ✅ COMPLIANT
- Dashboard uses existing LedgerService calculations
- Financial KPIs derived from source records
- No denormalized balance columns introduced
- Bulk query patterns maintained for performance

**VI. REST API Standards & Consistent Responses**: ✅ COMPLIANT
- Dashboard endpoints use `/api/dashboard/*` pattern
- All responses use BaseApiController helpers
- Consistent JSON envelope format maintained
- Proper HTTP status codes and error handling

**VII. Code Quality & Maintainability**: ✅ COMPLIANT
- Service layer separation for aggregation logic
- Reusable widget component architecture
- No code duplication in design
- Single responsibility principle followed

**VIII. Defensive Security**: ✅ COMPLIANT
- All inputs validated in models and controllers
- No secrets in frontend code
- Proper error handling without information leakage
- SQL injection prevention via parameterized queries

**IX. Error Handling & Observability**: ✅ COMPLIANT
- Graceful degradation for aggregation failures
- Comprehensive error logging for debugging
- Fallback to last known good data
- User-friendly error messages

**X. API Endpoint Testing (via curl)**: ✅ READY FOR IMPLEMENTATION
- Integration test plan defined in quickstart.md
- Happy path, error path, and tenant isolation tests planned
- Performance test procedures documented
- Tests will be executed via curl after implementation

**XI. Performance Discipline**: ✅ COMPLIANT
- Pre-aggregation prevents N+1 queries completely
- Multi-tier caching strategy designed
- Performance targets based on measurable requirements
- No speculative optimizations included

**FINAL GATE STATUS**: ✅ ALL PRINCIPLES COMPLIANT - Ready for implementation

## Complexity Tracking

> No constitution violations requiring justification

The dashboard feature design fully complies with all 11 constitutional principles. No complexity tracking entries are required as the design follows established patterns and introduces no architectural violations.
