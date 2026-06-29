# Research: Account Deletion Request

**Feature**: 078-account-deletion-request  
**Date**: 2026-05-19  
**Purpose**: Resolve technical unknowns and document architectural decisions

---

## Research Areas

### 1. Grace Period Calculation Strategy

**Question**: How should the 7-day grace period be calculated and tracked?

**Investigation**:
- Options: (a) Stored expiration timestamp vs (b) Stored request timestamp + calculated remaining days
- (a) Expiration timestamp is easier to query for expired records but requires updates if grace period duration changes
- (b) Request timestamp is simpler, allows flexible calculation, matches spec requirement of "7-day grace period"

**Decision**: Use stored request timestamp (`deletion_requested_at`) with backend calculation of remaining days.

**Rationale**:
- Aligns with spec language ("Start a 7-day grace period")
- Simpler to undo (clear timestamp rather than update expiration)
- Consistent with existing SchoolLedger timestamp patterns
- Query for expired records: `deletion_requested_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)`

---

### 2. Tenant Status State Machine

**Question**: What states should the tenant status field support?

**Investigation**:
- Current SchoolLedger tenant status likely has: `active`, `inactive` (or similar)
- Account deletion feature needs: `active` → `pending_deletion` → `deleted` (removed)

**Decision**: Add `pending_deletion` to tenant status enum. Keep `deleted` as implicit (record removed after grace period).

**Rationale**:
- Minimal change to existing schema
- Clear state for UI to display warning banners and undo option
- After deletion, record is removed entirely (no "deleted" status needed)

---

### 3. Reminder Email Timing Strategy

**Question**: When exactly should reminder emails be sent during the 7-day grace period?

**Investigation**:
- Spec says "every 3 days" with remaining days count
- Day 1: Request submitted
- Day 4: First reminder (4 days remaining) OR Day 3: First reminder (5 days remaining)
- Day 7: Final reminder (0 days remaining) OR Day 6: Final reminder (1 day remaining)

**Decision**: Send reminders on Day 4 and Day 7 (after 3 days and 6 days from request).

**Rationale**:
- Provides reminder at roughly halfway point (Day 4: 3 days passed, 3-4 days remaining)
- Final reminder on deletion day (Day 7) for urgency
- Aligns with "every 3 days" (Day 1 → Day 4 is 3 days later, Day 4 → Day 7 is 3 days later)
- Cron job can check daily: `WHERE deletion_requested_at = DATE_SUB(CURDATE(), INTERVAL 3 DAY)` for Day 4 reminder, `= DATE_SUB(CURDATE(), INTERVAL 6 DAY)` for Day 7 reminder

---

### 4. Tenant Data Deletion Order

**Question**: In what order should tenant data be deleted to avoid foreign key constraint violations?

**Investigation**:
- SchoolLedger has many tenant-scoped tables with tenant_id foreign keys
- Some tables have cascade deletes, others may need explicit deletion
- Must delete child records before parent records

**Decision**: Use batch DELETE queries per table, ordered from most dependent to least dependent.

**Rationale**:
- MySQL supports multi-table DELETE with JOINs for efficiency
- Alternatively, DELETE per table in dependency order
- Audit log entry should be created AFTER successful deletion (to record completion)
- Order: attendance → payments → charges → enrollments → students → classes → users → settings → tenant

---

### 5. Super Admin Deletion Execution

**Question**: How should the Super Admin trigger and execute permanent deletion?

**Investigation**:
- Options: (a) API endpoint callable by Super Admin, (b) CLI command only, (c) Both
- Spec says: "The deletion process must only be executable by the Super Admin" and "Add a custom PHP Spark command"
- Cron job will run the command automatically

**Decision**: CLI command only for permanent deletion. API endpoints for tenant admin request/undo only.

**Rationale**:
- Safer: No HTTP endpoint that could be accidentally called
- Aligns with spec requirement for PHP Spark command
- Super Admin can run manually via CLI or rely on automated cron job
- Reduces attack surface (no API endpoint for destructive operation)

---

### 6. Email Service Integration

**Question**: How should reminder emails be sent?

**Investigation**:
- SchoolLedger already has email service configured (based on previous features)
- CodeIgniter 4 has email library
- Emails should be sent asynchronously if possible, or during CLI command execution

**Decision**: Use existing CodeIgniter 4 email service within CLI command context.

**Rationale**:
- Consistent with existing architecture
- CLI command runs in background, so email sending won't block user requests
- Can use CodeIgniter's Email library or existing service wrapper

---

## Alternative Technologies Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Soft delete (paranoid pattern) with `deleted_at` | Spec requires permanent deletion; audit log serves compliance need |
| Separate `grace_period_expires_at` timestamp | Adds unnecessary complexity; `deletion_requested_at` + 7 days is sufficient |
| Queue-based async deletion | Overkill for v1; CLI command with batch queries meets performance requirements |
| API endpoint for Super Admin deletion | Security risk; CLI-only is safer for destructive operations |

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Should undo restore to `active` or previous state? | Always restore to `active` (spec requirement) |
| What if cron job fails to run? | Data remains in `pending_deletion` until command runs; no auto-delete without command |
| Can deletion be undone on Day 7? | Yes, until the CLI command processes it; once command runs, deletion is permanent |
| Should we notify tenant on successful deletion? | No, account is gone; Super Admin sees log output instead |

---

## Summary

All technical unknowns resolved. Architecture decisions:

1. **Timestamp Strategy**: Store `deletion_requested_at`, calculate remaining days backend-side
2. **Status State**: Add `pending_deletion` to tenant status
3. **Email Timing**: Days 4 and 7 (3-day intervals)
4. **Deletion Order**: Batch DELETE per table, child-to-parent order
5. **Super Admin Execution**: CLI command only, no API endpoint
6. **Email Integration**: Use existing CodeIgniter 4 email service

All decisions align with Constitution principles and SchoolLedger architecture patterns.
