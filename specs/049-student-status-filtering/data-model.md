# Data Model: Student Status Filtering

**Feature**: 049-student-status-filtering  
**Date**: 2026-04-28

---

## Entities (Existing — No Schema Changes Required)

### Student

Stored in `students` table.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID/string | Primary key |
| `tenant_id` | UUID/string | Multi-tenancy isolation key |
| `status` | ENUM | `active`, `inactive`, `transferred`, `dropped_out`, `graduated` |
| `first_name` | VARCHAR | |
| `last_name` | VARCHAR | |
| `admission_number` | VARCHAR | Unique per tenant |

**Status semantics for this feature**:
- `active` — included in all modules (transport, dashboard, attendance, payment search)
- `inactive`, `transferred`, `dropped_out`, `graduated` — excluded from transport/dashboard/attendance; included in payment search only

### StudentStatusHistory

Stored in `student_status_history` table (created by migration `2026-04-03-110000_Add_student_status_history.php`).

Immutable audit log. One row per status change event. Written atomically by `StudentController::changeStatus()`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | int | Auto-increment PK |
| `student_id` | UUID/string | FK → students.id |
| `tenant_id` | UUID/string | Isolation key |
| `from_status` | ENUM | Previous status |
| `to_status` | ENUM | New status |
| `effective_date` | DATE | When change takes effect |
| `reason` | TEXT | Required narrative |
| `created_at` | DATETIME | Record creation time |

### TransportAssignment

Stored in `transport_assignments` table.

| Field | Type | Notes |
|-------|------|-------|
| `id` | int | PK |
| `route_id` | UUID/string | FK → transport_routes.id |
| `student_id` | UUID/string | FK → students.id |
| `tenant_id` | UUID/string | Isolation key |
| `status` | ENUM | `active`, `inactive` — assignment-level status, independent of student status |
| `pickup_point` | VARCHAR | |
| `drop_point` | VARCHAR | |

**Important**: `transport_assignments.status` is independent of `students.status`. Both must be `active` for a student to appear in transport rosters.

---

## State Transitions

### Student Status

```
active ──→ inactive
active ──→ transferred
active ──→ graduated
active ──→ dropped_out
inactive ──→ active
```

Transitions are validated and recorded by `StudentController::changeStatus()`. No migration or schema change is needed to support these transitions — they are already defined.

---

## Query Filtering Rules

| Module | Filter Applied |
|--------|---------------|
| Students page list | `students.status = <selected tab>` (or all) |
| Transport rosters | `transport_assignments.status = 'active'` **AND** `students.status = 'active'` |
| Dashboard student count | `students.status = 'active'` |
| Class attendance roster | `students.status = 'active'` |
| Payment modal search | No status filter — all statuses returned |

---

## No Schema Migration Required

This feature involves query-level and frontend-level changes only. No new tables, columns, or index changes are needed.
