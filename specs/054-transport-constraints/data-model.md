# Data Model: Transport Constraints

**Feature**: 054-transport-constraints  
**Date**: 2026-04-30

## Schema Changes

### Migration: Add Transport Constraints

**File**: `backend/app/Database/Migrations/2026-04-30-120000_AddTransportConstraints.php`

```php
<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddTransportConstraints extends Migration
{
    public function up(): void
    {
        // 1. Add generated column for active status (for unique constraint)
        $this->db->query("ALTER TABLE transport_student_allocations 
            ADD COLUMN is_active TINYINT(1) AS (IF(status = 'active', 1, NULL)) STORED");

        // 2. Add unique constraint to enforce single active assignment per student
        // Note: MySQL allows multiple NULL values in unique index
        $this->db->query("ALTER TABLE transport_student_allocations 
            ADD UNIQUE INDEX idx_unique_active_assignment (tenant_id, student_id, is_active)");

        // 3. Add index for stop validation queries
        $this->forge->addKey(['route_id', 'id'], false, false, 'idx_stop_route_lookup');

        // 4. Add index for missing charge detection
        $this->forge->addKey(['student_id', 'charge_type', 'academic_session'], 
            false, false, 'idx_charge_lookup');
    }

    public function down(): void
    {
        // Remove constraints (order matters)
        $this->db->query("ALTER TABLE transport_student_allocations 
            DROP INDEX idx_unique_active_assignment");
        
        $this->db->query("ALTER TABLE transport_student_allocations 
            DROP COLUMN is_active");
        
        // Note: MySQL doesn't support IF EXISTS for DROP INDEX in older versions
        // Migration should handle errors gracefully
    }
}
```

### Trigger for Auto-Deallocation (Alternative: Model Hook)

**Note**: CodeIgniter 4 recommends using Model Events over database triggers for better testability. The auto-deallocation will be implemented via `StudentModel::afterUpdate` hook.

```php
// In StudentModel::afterUpdate
protected $afterUpdate = ['handleStatusChange'];

protected function handleStatusChange(array $data): array
{
    $newStatus = $data['data']['status'] ?? null;
    $oldStatus = $data['data']['status_original'] ?? null;
    
    // If status changed FROM active TO non-active
    if ($oldStatus === 'active' && $newStatus !== 'active') {
        $this->deactivateTransportAssignments($data['id']);
    }
    
    return $data;
}

private function deactivateTransportAssignments(string $studentId): void
{
    $db = $this->db;
    $db->table('transport_student_allocations')
        ->where('student_id', $studentId)
        ->where('status', 'active')
        ->update([
            'status' => 'inactive',
            'end_date' => date('Y-m-d'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
}
```

## Entity Relationships

### Existing Entities (No Changes)

```
transport_routes
├── id (PK)
├── tenant_id (FK)
├── route_name
├── monthly_fee
├── status
└── ...

transport_stops
├── id (PK)
├── tenant_id (FK)
├── route_id (FK)
├── name
├── order_position
└── ...

students
├── id (PK)
├── tenant_id (FK)
├── first_name
├── last_name
├── status (enum: active, withdrawn, suspended, graduated, transferred)
└── ...

charges
├── id (PK)
├── tenant_id (FK)
├── student_id (FK)
├── route_id (FK, nullable)
├── charge_type (enum: tuition, transport, ...)
├── academic_session (YYYY-MM)
├── amount
└── ...
```

### Modified Entity

```
transport_student_allocations (with new constraints)
├── id (PK) - VARCHAR(50)
├── tenant_id (FK) - VARCHAR(50)
├── student_id (FK) - VARCHAR(50)
├── route_id (FK) - VARCHAR(50)
├── stop_id (FK) - VARCHAR(50), NOT NULL after migration
├── direction - ENUM('both', 'inbound', 'outbound')
├── academic_year - VARCHAR(20)
├── start_date - DATE
├── end_date - DATE (nullable)
├── status - ENUM('active', 'inactive')
├── notes - TEXT (nullable)
├── created_at - DATETIME
├── updated_at - DATETIME
├── is_active - TINYINT(1) GENERATED COLUMN (for unique constraint) NEW
│
└── CONSTRAINTS:
    ├── PRIMARY KEY (id)
    ├── FOREIGN KEY (stop_id) → transport_stops(id)
    ├── UNIQUE INDEX (tenant_id, student_id, is_active) - PREVENTS DUPLICATE ACTIVE
    └── INDEX (tenant_id, route_id, status)
```

## Validation Rules

### Transport Assignment Creation

```php
$rules = [
    'studentId' => 'required|string|exists_students',
    'routeId'   => 'required|string|exists_transport_routes',
    'stopId'    => 'required|string|stop_belongs_to_route[routeId]',
    'direction' => 'in_list[both,inbound,outbound]',
    'notes'     => 'permit_empty|string|max_length[1000]',
];
```

### Transport Assignment Reassignment

```php
$rules = [
    'studentId'    => 'required|string',
    'fromRouteId'  => 'required|string',
    'toRouteId'    => 'required|string|different[fromRouteId]',
    'toStopId'     => 'required|string|stop_belongs_to_route[toRouteId]',
    'reassignDate' => 'required|valid_date|date_not_in_future',
];
```

## Computed Queries

### Missing Charge Detection

```sql
-- Get students with active transport assignments but no charge for given month
SELECT 
    tsa.student_id,
    tsa.route_id,
    r.route_name,
    r.monthly_fee,
    s.first_name,
    s.last_name
FROM transport_student_allocations tsa
JOIN transport_routes r ON r.id = tsa.route_id
JOIN students s ON s.id = tsa.student_id
LEFT JOIN charges c ON c.student_id = tsa.student_id 
    AND c.route_id = tsa.route_id
    AND c.charge_type = 'transport'
    AND c.academic_session = :month
WHERE tsa.tenant_id = :tenantId
    AND tsa.status = 'active'
    AND s.status = 'active'
    AND c.id IS NULL
ORDER BY r.route_name, s.last_name;
```

### Student Transport History

```sql
-- Get complete transport history for a student
SELECT 
    tsa.id as allocation_id,
    tsa.route_id,
    r.route_name,
    r.monthly_fee,
    tsa.stop_id,
    ts.name as stop_name,
    tsa.direction,
    tsa.start_date,
    tsa.end_date,
    tsa.status,
    tsa.notes,
    tsa.academic_year,
    tsa.created_at as assigned_date
FROM transport_student_allocations tsa
JOIN transport_routes r ON r.id = tsa.route_id
LEFT JOIN transport_stops ts ON ts.id = tsa.stop_id
WHERE tsa.tenant_id = :tenantId
    AND tsa.student_id = :studentId
ORDER BY tsa.start_date DESC, tsa.created_at DESC;
```

### Active Assignment Lookup

```sql
-- Check if student has active assignment (used in validation)
SELECT 
    tsa.id,
    tsa.route_id,
    r.route_name
FROM transport_student_allocations tsa
JOIN transport_routes r ON r.id = tsa.route_id
WHERE tsa.tenant_id = :tenantId
    AND tsa.student_id = :studentId
    AND tsa.status = 'active'
LIMIT 1;
```

## State Transitions

### Transport Assignment Lifecycle

```
┌─────────────┐
│   PENDING   │ (Initial state after validation, before DB insert)
└──────┬──────┘
       │ INSERT
       ▼
┌─────────────┐
│   ACTIVE    │ ◄──── Can be reassigned to another route
│  (start_date│       (ends current, creates new ACTIVE)
│   set)      │
└──────┬──────┘
       │ Status change / Manual removal
       ▼
┌─────────────┐
│  INACTIVE   │
│  (end_date  │
│   set)      │
└─────────────┘
```

### Student Status → Transport Assignment

```
Student Status Change:
┌──────────────┐
│    active    │
└──────┬───────┘
       │ Admin updates status to non-active
       ▼
┌──────────────┐
│  withdrawn   │ ──┐
│  suspended   │ ──┼──► Triggers auto-deallocation
│  graduated   │ ──┤    of ALL active transport
│  transferred │ ──┘    assignments for this student
└──────────────┘
```

## Index Strategy

| Index Name | Columns | Purpose | Usage |
|------------|---------|---------|-------|
| idx_unique_active_assignment | (tenant_id, student_id, is_active) | Prevents duplicate active assignments | Constraint enforcement, validation lookup |
| idx_alloc_route_status | (tenant_id, route_id, status) | Route roster queries | `getRoutes()`, `getDriverRoster()` |
| idx_alloc_student | (tenant_id, student_id) | Student lookup | History queries, status change hook |
| idx_stop_route | (route_id, id) | Stop validation | `createAllocation()` stop verification |
| idx_charge_lookup | (student_id, charge_type, academic_session) | Missing charge detection | `getMissingCharges()` query |

## Migration Rollback Safety

All schema changes are reversible:

1. **Generated column removal**: `is_active` is computed, removing it doesn't affect data
2. **Unique index removal**: Dropping index doesn't affect existing data
3. **Application compatibility**: Code will continue to work with or without the constraints (graceful degradation)

**Rollback order**:
1. Deploy code that doesn't depend on `is_active` column (if any)
2. Drop unique index
3. Drop generated column
