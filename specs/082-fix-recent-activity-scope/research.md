# Research: Synthesizing Tenant Activity Feed

**Date**: 2026-05-22
**Feature**: 082-fix-recent-activity-scope

## Problem
The Tenant Dashboard Recent Activity feed currently only shows `payments`. The requirement is to show a mix of recent activities: payments received, student enrolments, student status changes, and staff leave approvals. We need a performant way to aggregate these distinct events across multiple tenant-scoped tables and present them as a unified chronological feed.

## Alternatives Considered

### Option 1: Dedicated `tenant_audit` log table
Create a new `tenant_audit` table and record every relevant action via a service (similar to `platform_audit`).
- **Pros**: Easy to query, extensible.
- **Cons**: Requires schema migration. Requires retroactively populating past events if we want historical data. Adds overhead to every write operation.

### Option 2: Multi-source UNION Query
Construct a single SQL `UNION ALL` query in `Api\DashboardController` (or a dedicated Service/Model) that aggregates the latest `N` rows from each table, sorts them, and limits to `N`.
- **Pros**: Zero schema changes. Accurate up-to-date data. Does not duplicate data.
- **Cons**: Query syntax can be complex. `UNION` across unindexed dates can be slow, but since each subquery can use the `tenant_id` and order by its own date/created_at, the subqueries can be optimized.

### Option 3: Backend PHP Aggregation
Fetch the top `N` records from each table individually, merge them in PHP, sort by timestamp, and slice the top `N`.
- **Pros**: Easy to write and maintain using existing Models.
- **Cons**: Slightly more memory overhead.

## Decision: Option 3 (Backend PHP Aggregation)
Given the small limit (`N` usually 5-10), fetching the top `N` from each of the 4 tables (payments, enrollments, student_status_history, leave_requests) yields at most 40 records in memory. Sorting 40 arrays in PHP and taking the top `N` is extremely fast (O(M log M) where M <= 40). This avoids complex raw SQL UNIONs and cleanly leverages CodeIgniter's Query Builder per table, keeping code maintainable and perfectly tenant-isolated.

## Decision: Platform Feed Prefix Scope
For the Control Panel Dashboard, `Platform\DashboardController::activity()` will simply add a `LIKE 'platform.%'` filter to its query on `platform_audit`. This effectively filters out `payment.success` and other tenant-level events, resolving the platform isolation issue.
