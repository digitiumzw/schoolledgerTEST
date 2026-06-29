# Research Findings: Dashboard Data Aggregation and Decision Support

**Date**: 2026-05-08  
**Feature**: Dashboard Data Aggregation and Decision Support  
**Purpose**: Resolve technical decisions and identify best practices for implementation

## Background Job Strategy for KPI Aggregation

**Decision**: Use CodeIgniter 4's built-in command line interface for scheduled jobs combined with MySQL events for frequent updates.

**Rationale**: 
- CodeIgniter 4 provides `php spark` command structure for background jobs
- MySQL events can handle high-frequency (every 5 minutes) aggregations efficiently
- Existing SchoolLedger codebase already uses spark commands
- No additional dependencies required

**Alternatives considered**:
- Redis-based job queue: Overkill for current aggregation needs
- External cron jobs: Less portable across deployment environments
- Message queue system: Adds unnecessary complexity for simple aggregations

## Pre-Aggregated Metrics Storage Strategy

**Decision**: Create dedicated `dashboard_kpi_metrics` table with time-based snapshots.

**Rationale**:
- Enables historical trend analysis
- Supports fallback to last known good data
- Simplifies query performance for dashboard loading
- Allows easy cache invalidation strategies

**Alternatives considered**:
- In-memory caching only: No persistence, lost on restart
- Materialized views: MySQL limitations, complex refresh logic
- NoSQL document store: Adds operational complexity

## Widget Configuration and Role-Based Display

**Decision**: Store widget configurations in database with role-based filtering in backend service.

**Rationale**:
- Dynamic widget configuration without code changes
- Role enforcement at API layer ensures security
- Consistent with existing RBAC patterns
- Enables future widget additions without frontend deployment

**Alternatives considered**:
- Hardcoded widgets per role: Inflexible, requires code changes
- Frontend-only role filtering: Security risk, potential data leakage
- Configuration files: Less dynamic, requires deployment for changes

## Performance Optimization Strategy

**Decision**: Multi-layer caching approach with database-level aggregation and application tier caching.

**Rationale**:
- Database level: Pre-aggregated tables prevent expensive joins
- Application level: CodeIgniter caching for frequently accessed data
- Frontend level: React Query with 5-minute stale time
- Meets 95% cache hit ratio requirement

**Alternatives considered**:
- Database only: May not meet 5-second load targets
- Frontend only: Security risk, potential stale data
- External cache (Redis): Additional operational overhead

## Drill-Down Navigation Implementation

**Decision**: Standardized navigation configuration with query parameter filtering.

**Rationale**:
- Consistent with existing SchoolLedger navigation patterns
- Enables bookmarkable drill-down states
- Simple implementation with minimal frontend complexity
- Supports role-based access control on target pages

**Alternatives considered**:
- Modal-based drill-down: Complex state management
- Separate drill-down pages: Duplicates existing functionality
- Client-side filtering: Performance issues with large datasets

## Error Handling and Fallback Strategy

**Decision**: Graceful degradation with last known good data and clear error indicators.

**Rationale**:
- Dashboard remains functional during aggregation failures
- Clear visual indicators inform users of data freshness
- Consistent with existing error handling patterns
- Prevents cascade failures affecting other system components

**Alternatives considered**:
- Fail fast with error pages: Poor user experience
- Retry mechanisms: May mask underlying issues
- Silent failures: Users unaware of data problems

## Multi-Tenant Isolation Strategy

**Decision**: Tenant-scoped aggregation jobs and metrics tables with composite primary keys.

**Rationale**:
- Maintains strict data isolation as required by Constitution Principle I
- Enables per-tenant aggregation schedules
- Prevents cross-tenant data leakage in all scenarios
- Consistent with existing tenant_id patterns

**Alternatives considered**:
- Shared metrics with tenant filtering: Complex query logic
- Separate databases per tenant: Operational complexity
- Application-level isolation: Risk of implementation errors

## Technology Stack Alignment

**Decision**: Use existing SchoolLedger stack with minimal additions.

**Rationale**:
- PHP 8.1+ and CodeIgniter 4 for backend consistency
- React 18 with TanStack Query for frontend state management
- MySQL for data persistence with optimized indexing
- No new dependencies required for core functionality

**Alternatives considered**:
- Node.js backend: Would require complete rewrite
- Vue.js frontend: Inconsistent with existing codebase
- PostgreSQL: Migration overhead, MySQL sufficient for needs

## Security Considerations

**Decision**: Defense-in-depth approach with API tier and frontend tier role enforcement.

**Rationale**:
- Backend role enforcement prevents unauthorized data access
- Frontend role filtering provides UX optimization only
- JWT-based authentication maintains existing security model
- Input validation and sanitization prevents injection attacks

**Alternatives considered**:
- Frontend-only security: Insufficient protection
- Backend-only security: Poor user experience
- Additional authentication layers: Unnecessary complexity

## Testing Strategy

**Decision**: Multi-layer testing with curl-based integration tests as required by Constitution Principle X.

**Rationale**:
- PHPUnit for backend unit and integration tests
- Jest for frontend component tests
- curl integration tests for end-to-end API validation
- Performance testing for load targets verification

**Alternatives considered**:
- Browser automation: Overkill for API-only features
- Internal test frameworks: Doesn't validate full request cycle
- Manual testing only: Insufficient coverage and reproducibility

## Summary

All technical decisions align with existing SchoolLedger patterns and constitutional requirements. The chosen approach provides:

- Performance: Pre-aggregation and multi tier caching meet 5-second load targets
- Security: Multi tenant isolation and role-based access prevent data leakage
- Maintainability: Uses existing stack and patterns with minimal new dependencies
- Scalability: Background aggregation and efficient queries support 100+ concurrent users
- Reliability: Graceful degradation and error handling ensure dashboard availability

No NEEDS CLARIFICATION items remain. Ready to proceed to Phase 1 design.
