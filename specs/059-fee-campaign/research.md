# Research: Fee Campaign

**Feature**: 059-fee-campaign  
**Date**: 2026-05-04

## R1: Campaign Payment Isolation from Standard Ledger

**Decision**: Campaign payments are stored in the existing `payments` table with a non-null `fee_campaign_id` FK. The standard ledger balance calculation (`LedgerService::getStudentBalance`) is updated to exclude rows where `fee_campaign_id IS NOT NULL`. Campaign balances are computed independently from the `campaign_students` table.

**Rationale**: Reusing the `payments` table means campaign payments automatically appear in the student's general payment history, revenue-by-category reports, and receipt generation — without duplicating the payment recording infrastructure. The additive WHERE clause on the ledger query is a single-line, backward-compatible change.

**Alternatives considered**:
- **Separate `campaign_payments` table**: Would require duplicating payment validation, receipt generation, and reporting logic. Rejected — violates DRY (Principle VII).
- **Use charges table for campaigns**: Would entangle campaign tracking with the fee_rule-based billing engine. Rejected — directly contradicts the spec requirement that campaigns are separate from the standard billing system (FR-019).
- **Tag column on payments**: A generic `tag` or `context` column instead of a typed FK. Rejected — weaker referential integrity, harder to query, no cascade behavior.

## R2: Auto-Assignment Strategy (Bulk Insert Performance)

**Decision**: Use a single batch INSERT via CodeIgniter's `insertBatch()` to create all `campaign_students` records in one query. Build the array in PHP from the eligible student query result, then insert in one operation.

**Rationale**: For up to 500 students (SC-001 target), a single batch INSERT completes in well under 1 second on MySQL. Individual INSERTs in a loop would generate 500 round-trips — unnecessarily slow.

**Alternatives considered**:
- **Individual INSERT per student**: Simple but O(n) round-trips. Rejected for performance at scale.
- **Queue/async job**: Overkill for sub-second operations with ≤500 rows. Rejected — adds infrastructure complexity without measurable benefit.
- **Stored procedure**: Would improve latency marginally but violates the project convention of keeping business logic in PHP (Principle VII). Rejected.

## R3: Scope Resolution (Which Students Are Eligible)

**Decision**: Reuse the same scope resolution pattern established in `FeeRuleBillingService::getEligibleStudents()`. Campaign target scopes are:
- `school_wide`: all active students for the tenant.
- `class`: active students where `students.class_id` matches the scope ID(s). Supports multi-class targeting (JSON array of class IDs, same as feature 057).

The `FeeCampaignService::resolveEligibleStudents()` method will implement this logic. It does NOT call `FeeRuleBillingService` directly — it is a parallel implementation to avoid coupling campaigns to the billing engine.

**Rationale**: The scope types align with existing student data. Multi-class support reuses the JSON-array encoding from feature 057. No new tables or relationships needed.

**Alternatives considered**:
- **Reuse FeeRuleBillingService directly**: Would create a dependency between campaigns and fee rules. Rejected — campaigns are intentionally decoupled from the billing engine.
- **Grade-level targeting**: Would require a grade_level column on students or classes. Out of scope for v1 — class-based targeting is sufficient. Can be added later.

## R4: Campaign Payment Category

**Decision**: When a campaign payment is recorded in the `payments` table, the `category` field is set to the campaign name (e.g., "Grade 7 Exam Fee"). This makes campaign payments visible and identifiable in the general payment list and revenue-by-category reports.

**Rationale**: Using the campaign name as the category provides natural grouping in existing reports without any reporting code changes. The `fee_campaign_id` FK provides the machine-readable link for precise queries.

**Alternatives considered**:
- **Fixed category "Campaign"**: Too generic — loses the ability to distinguish between different campaigns in reports. Rejected.
- **System-managed payment category**: Would require auto-creating a PaymentCategory row per campaign. Adds complexity and clutters the category settings. Rejected.

## R5: Ledger Balance Exclusion Strategy

**Decision**: Modify `LedgerService::getStudentBalance()` to add `WHERE fee_campaign_id IS NULL` to the fee payment SUM queries. This is a single additive WHERE clause per payment subquery. No changes to charge queries (campaigns don't create charges).

**Rationale**: This is the minimal change needed to preserve ledger integrity (Principle V). The column defaults to NULL for all existing payment rows, so the WHERE clause is backward-compatible — no existing balances change.

**Alternatives considered**:
- **No exclusion (include campaign payments in balance)**: Would inflate the "paid" side of the ledger, creating phantom credits. Rejected — violates FR-019.
- **Separate payment table**: Would avoid the need for exclusion but requires duplicating all payment infrastructure. Rejected (see R1).

## R6: Closed Campaign Guard

**Decision**: The `fee_campaigns.status` column uses an ENUM-like check (`active`/`closed`). The `FeeCampaignService::recordPayment()` method checks campaign status before recording. The controller returns 409 Conflict if the campaign is closed.

**Rationale**: 409 Conflict is the appropriate HTTP status — the request is valid in format but conflicts with the current resource state. The status check is a simple guard in the service layer.

**Alternatives considered**:
- **Soft-delete closed campaigns**: Would hide them from queries. Rejected — closed campaigns must remain visible in the archived list (US5).
- **Separate `archived` boolean**: Adds a second status dimension without benefit. Rejected — a single `status` field with `active`/`closed` is sufficient.

## R7: Student Removal with Existing Payments

**Decision**: When removing a student from a campaign who has recorded payments:
1. The service requires an explicit `force: true` flag from the controller.
2. The `campaign_students` row is hard-deleted.
3. The corresponding `payments` rows (with `fee_campaign_id` pointing to this campaign) are NOT deleted — they remain in the general ledger for audit.
4. The `fee_campaign_id` on orphaned payment rows remains set (the FK is not cascaded on delete of `campaign_students` — it references `fee_campaigns`, not `campaign_students`).

**Rationale**: Payment records are financial audit artifacts and must never be deleted (Principle V). The campaign student record is just a tracking convenience — removing it simply removes the student from the campaign's progress view. The payment history persists independently.

**Alternatives considered**:
- **Cascade delete payments**: Violates audit/financial integrity. Rejected unconditionally.
- **Soft-delete campaign_students**: Adds complexity for a rare operation. Rejected — hard delete with payment preservation is simpler and correct.
