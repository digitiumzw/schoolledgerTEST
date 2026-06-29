# Data Model: Account Deletion Request

**Feature**: 078-account-deletion-request  
**Date**: 2026-05-19

---

## Entity: Tenant (Extended)

The existing `tenants` table receives two new fields to support deletion requests.

### Schema Changes

```php
// Migration: 2026-05-19-000001_AddDeletionFieldsToTenants.php
// Adds to existing tenants table:

'deletion_requested_at' => [
    'type' => 'DATETIME',
    'null' => true,
    'comment' => 'Timestamp when deletion was requested; NULL if not requested'
],

'status' => [
    'type' => 'ENUM',
    'constraint' => ['active', 'pending_deletion'],
    'default' => 'active',
    'comment' => 'Account status: active or pending deletion'
]
```

### Indexes

```php
// For cron job queries finding pending deletions
$this->forge->addKey('status', false, false, 'idx_tenants_status');

// For cron job queries finding expired deletions by date
$this->forge->addKey('deletion_requested_at', false, false, 'idx_tenants_deletion_requested_at');

// Composite for efficient filtering
$this->forge->addKey(['status', 'deletion_requested_at'], false, false, 'idx_tenants_status_deletion_date');
```

### State Transitions

```
Active ──[Request Deletion]──► Pending Deletion ──[7 days pass]──► [CLI Command] ──► Deleted (removed)
                                          │
                                          └──[Undo]──► Active
```

---

## Entity: DeletionAuditLog (New)

Tracks all deletion requests and completions for compliance and auditing.

### Schema

```php
// Migration: 2026-05-19-000002_CreateDeletionAuditLogTable.php
// New table: deletion_audit_log

'id' => [
    'type' => 'VARCHAR',
    'constraint' => 36,
    'primary_key' => true,
    'comment' => 'UUID for audit log entry'
],

'tenant_id' => [
    'type' => 'VARCHAR',
    'constraint' => 36,
    'null' => false,
    'comment' => 'Reference to tenant (may be NULL after deletion, but we keep the ID)'
],

'requested_by_email' => [
    'type' => 'VARCHAR',
    'constraint' => 255,
    'null' => false,
    'comment' => 'Email of admin who requested deletion'
],

'status' => [
    'type' => 'ENUM',
    'constraint' => ['requested', 'canceled', 'completed'],
    'null' => false,
    'comment' => 'Audit status of the deletion lifecycle'
],

'requested_at' => [
    'type' => 'DATETIME',
    'null' => false,
    'comment' => 'When deletion was requested'
],

'completed_at' => [
    'type' => 'DATETIME',
    'null' => true,
    'comment' => 'When deletion was completed (or canceled); NULL if still pending'
],

'created_at' => [
    'type' => 'DATETIME',
    'null' => false,
    'default' => new RawSql('CURRENT_TIMESTAMP')
],

'updated_at' => [
    'type' => 'DATETIME',
    'null' => false,
    'default' => new RawSql('CURRENT_TIMESTAMP'),
    'on_update' => new RawSql('CURRENT_TIMESTAMP')
]
```

### Indexes

```php
// For querying by tenant
$this->forge->addKey('tenant_id', false, false, 'idx_audit_tenant_id');

// For querying by status (finding pending/completed)
$this->forge->addKey('status', false, false, 'idx_audit_status');

// For date-range queries
$this->forge->addKey('requested_at', false, false, 'idx_audit_requested_at');

// Composite for tenant history queries
$this->forge->addKey(['tenant_id', 'requested_at'], false, false, 'idx_audit_tenant_requested');
```

### Foreign Keys

```php
// Note: Foreign key to tenants table is optional since tenant may be deleted
// If we want to keep the reference even after tenant deletion:
// $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'SET NULL', 'CASCADE');

// Alternative: No foreign key constraint to allow tenant deletion without blocking
// The tenant_id remains as a reference value even after tenant is gone
```

---

## Entity Relationships

```
Tenant 1:0..1 DeletionAuditLog
- One tenant may have zero or one active (non-completed) deletion audit log entry
- Tenant may have multiple completed/canceled entries in history

DeletionAuditLog *:* Tenant (historical)
- Audit log maintains records even after tenant is deleted
- tenant_id in audit log serves as historical reference only
```

---

## Tenant Data Deletion Order

When permanent deletion executes, data is removed in this order (child tables first to avoid FK violations):

### Deletion Sequence

1. **student_attendance_events** (if exists) - Most granular, no dependencies
2. **student_class_attendance** (if exists) - Attendance records
3. **attendance** (staff attendance)
4. **ledger_adjustments** - Financial adjustments
5. **payments** - Payment records
6. **charges** - Charge/billing records
7. **campaign_students** - Fee campaign memberships
8. **fee_campaigns** - Fee campaigns
9. **transport_student_allocations** - Transport assignments
10. **transport_routes** - Transport routes
11. **transport_vehicles** - Transport vehicles
12. **transport_drivers** - Transport drivers
13. **student_status_history** - Student status change audit
14. **student_profile_history** - Student profile change audit
15. **enrollments** - Student-class enrollments
16. **students** - Student records
17. **class_migrations** - Class migration records
18. **classes** - Class records
19. **academic_terms** - Academic term records
20. **settings** - Tenant settings
21. **users** - Tenant admin users
22. **deletion_audit_log** - Mark entry as completed (after all data removed)
23. **tenants** - Finally, remove the tenant record itself

### Batch Deletion Strategy

For each table, use batch DELETE with tenant_id filter:

```sql
-- Example for students table
DELETE FROM students WHERE tenant_id = :tenant_id LIMIT 1000;
-- Repeat until 0 rows affected
```

Or for CodeIgniter 4:

```php
$builder = $this->db->table('students');
$builder->where('tenant_id', $tenantId);
$builder->delete();
```

---

## Validation Rules

### Tenant Status Transitions

| From | To | Allowed When |
|------|----|--------------|
| active | pending_deletion | User is tenant admin, no existing pending deletion |
| pending_deletion | active | Undo requested within 7-day grace period, tenant still exists |
| pending_deletion | deleted | 7+ days elapsed, Super Admin CLI command executed |

### DeletionAuditLog Status Transitions

| From | To | Trigger |
|------|----|---------|
| (new) | requested | Tenant admin requests deletion |
| requested | canceled | Tenant admin undoes deletion |
| requested | completed | 7+ days elapsed, CLI command processes deletion |

---

## Computed Fields

### Remaining Grace Period Days (Backend Calculation)

```php
public function getRemainingDays(): ?int
{
    if ($this->deletion_requested_at === null) {
        return null;
    }
    
    $requestedAt = new DateTime($this->deletion_requested_at);
    $expiresAt = $requestedAt->modify('+7 days');
    $now = new DateTime();
    
    if ($now >= $expiresAt) {
        return 0;
    }
    
    return $now->diff($expiresAt)->days;
}
```

### Deletion Expired Check (Backend Calculation)

```php
public function isDeletionExpired(): bool
{
    if ($this->deletion_requested_at === null) {
        return false;
    }
    
    $requestedAt = new DateTime($this->deletion_requested_at);
    $expiresAt = $requestedAt->modify('+7 days');
    $now = new DateTime();
    
    return $now >= $expiresAt;
}
```

---

## API Response Data Shape

### Tenant Deletion Status Response

```json
{
  "status": "success",
  "data": {
    "deletionRequested": true,
    "requestedAt": "2026-05-19T14:30:00Z",
    "expiresAt": "2026-05-26T14:30:00Z",
    "remainingDays": 7,
    "canUndo": true
  }
}
```

### Deletion Request Response

```json
{
  "status": "success",
  "data": {
    "tenantId": "t1234567890",
    "status": "pending_deletion",
    "requestedAt": "2026-05-19T14:30:00Z",
    "expiresAt": "2026-05-26T14:30:00Z",
    "remainingDays": 7,
    "message": "Account deletion requested. You have 7 days to undo this request."
  }
}
```

---

## Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| tenants | idx_tenants_status | Filter pending deletions in cron job |
| tenants | idx_tenants_deletion_requested_at | Date-based queries for expired deletions |
| tenants | idx_tenants_status_deletion_date | Combined filtering |
| deletion_audit_log | idx_audit_tenant_id | Query by tenant |
| deletion_audit_log | idx_audit_status | Query by audit status |
| deletion_audit_log | idx_audit_requested_at | Date-range queries |
| deletion_audit_log | idx_audit_tenant_requested | Tenant history queries |
