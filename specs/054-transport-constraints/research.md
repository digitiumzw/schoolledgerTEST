# Research: Transport Constraints Implementation Decisions

**Feature**: 054-transport-constraints  
**Date**: 2026-04-30  
**Purpose**: Resolve specification clarifications and document design decisions

## Clarification Resolution

### Reassignment Billing Behavior (Resolved)

**Question**: When a student is reassigned from Route A to Route B within the same month, should the system:
- Update existing charge to Route B's fee?
- Keep Route A's charge and create adjustment?
- Apply two separate full charges?

**Decision**: Option B - Keep Route A's charge and create adjustment

**Rationale**:
1. **Audit Trail Integrity**: Route A provided service for part of the month. Keeping the original charge preserves the historical record of service delivery and payment.

2. **Prorated Billing Support**: The charge generation system already supports monthly billing. A mid-month reassignment should:
   - Keep the Route A charge for the portion of month served
   - Generate a new Route B charge for the remaining portion (prorated)
   - Or generate a full Route B charge if school policy charges full month regardless of start date

3. **Existing Pattern**: The current `generateMonthlyCharges()` method in TransportController (lines 263-333) uses idempotent charge creation - it skips students who already have charges. This pattern supports the "keep existing, create new" approach.

4. **Financial Accuracy**: The ledger must reflect actual service delivery. If a student was on Route A for 14 days and Route B for 16 days, the charges should reflect the routes that actually provided service.

**Implementation Approach**:
- Reassignment operation is atomic (database transaction)
- Old assignment ends with `end_date` set to reassignment date - 1 day
- New assignment starts with `start_date` set to reassignment date
- Existing charges for the month are NOT modified
- Next month's charge generation will naturally pick up the new route's fee
- For mid-month proration, a separate "transport adjustment" feature would be needed (out of scope for this feature)

**Default Behavior**: Full-month charges apply regardless of assignment date. Schools wishing to prorate must use manual adjustments (consistent with current system capabilities per spec assumption).

## Technical Research Findings

### Database Constraint Strategy

**Option A**: Unique index on `(student_id, status)` with partial index (MySQL 8.0.13+)
- `CREATE UNIQUE INDEX idx_unique_active_assignment ON transport_student_allocations(student_id) WHERE status = 'active'`
- **Rejected**: MySQL in CodeIgniter 4 environment doesn't support partial indexes

**Option B**: Functional unique index using generated column
- Add `is_active` generated column: `is_active TINYINT(1) AS (IF(status = 'active', 1, NULL)) STORED`
- Create unique index on `(student_id, is_active)`
- **Selected**: Works in MySQL 5.7+ and provides database-level enforcement

**Option C**: Application-level check with optimistic locking
- Check for existing active assignment before insert
- **Rejected**: Race condition possible between check and insert

**Selected Approach**: Option B - Generated column with unique index

### Trigger vs Application Logic for Auto-Deallocation

**Option A**: Database trigger on `students` table UPDATE
- Pros: Guaranteed execution, no application code path dependencies
- Cons: Logic in database, harder to test, opaque to developers

**Option B**: Model hook in StudentModel (CodeIgniter `beforeUpdate`/`afterUpdate`)
- Pros: Explicit code path, testable, visible to developers
- Cons: Only triggers when using Model methods; raw queries bypass

**Option C**: Service layer method that handles both operations
- Pros: Explicit transaction boundary, business logic centralized
- Cons: Requires all status changes to use the service method

**Selected Approach**: Option B (Model hook) + Option C (Service layer) hybrid
- Primary path: Service method `StudentStatusService::updateStatus()` handles status change + transport deallocation in transaction
- Safety net: Model `afterUpdate` hook catches direct model updates and triggers deallocation
- This ensures correctness regardless of code path while keeping business logic visible

### Stop Validation Strategy

**Challenge**: Need to validate that `stop_id` belongs to the `route_id` being assigned.

**Option A**: Foreign key with composite reference (not possible - stops table has single-column PK)

**Option B**: Application validation querying stops table
- Query: `SELECT 1 FROM transport_stops WHERE id = ? AND route_id = ?`
- **Selected**: Simple, explicit, testable

**Option C**: Database CHECK constraint with subquery
- **Rejected**: MySQL CHECK constraints can't reference other tables

### Missing Charge Alert Implementation

**Option A**: Database view
- `CREATE VIEW missing_transport_charges AS ...`
- Pros: Query is stored in schema, optimizable
- Cons: View definitions can be complex, harder to parameterize by month

**Option B**: Application query using LEFT JOIN / NOT EXISTS
- Pros: Flexible, can parameterize by month/route, testable
- Cons: Query logic duplicated if needed in multiple places

**Option C**: Materialized table with scheduled refresh
- **Rejected**: Overkill for this use case; real-time data preferred

**Selected Approach**: Option B - Application query in service layer
- `TransportAlertService::getMissingCharges($month, $routeId = null)`
- Query pattern: Active allocations LEFT JOIN charges on student_id + route_id + month WHERE charge.id IS NULL

## Design Decisions Summary

| Decision | Selected Approach | Rationale |
|----------|-------------------|-----------|
| Reassignment billing | Keep existing, new assignment starts fresh | Preserves audit trail, matches idempotent charge pattern |
| Single route constraint | Generated column + unique index | Database-level enforcement, race-condition proof |
| Auto-deallocation | Model hook + Service method hybrid | Ensures correctness on all code paths |
| Stop validation | Application query | Flexible, testable, no schema complexity |
| Missing charges | Service query (not view) | Parameterizable, easier to maintain |

## Performance Considerations

1. **Index on transport_student_allocations(student_id, status)**: Required for both the unique constraint and common lookup queries

2. **Index on charges(student_id, charge_type, academic_session)**: Optimizes the missing charge detection query

3. **Composite index on transport_stops(route_id, id)**: Optimizes stop validation query

4. **Transaction isolation**: Reassignment operations use `REPEATABLE READ` or `SERIALIZABLE` to prevent phantom reads during the atomic end+create operation

## References

- Existing TransportController: `backend/app/Controllers/Api/TransportController.php`
- Existing StudentModel: `backend/app/Models/StudentModel.php`
- Migration pattern: `backend/app/Database/Migrations/2026-04-28-100001_Create_transport_period_allocation_tables.php`
