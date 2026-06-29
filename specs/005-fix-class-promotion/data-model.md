# Data Model: Fix Class Promotion Logic

**Branch**: `005-fix-class-promotion` | **Date**: 2026-04-06

## Schema Change: `classes` table

### New Column

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `is_final_class` | `TINYINT(1)` | NO | `0` | `1` = intentional graduation/final class; `0` = normal class (may or may not have `next_class_id` set) |

### Migration File

**Filename**: `backend/app/Database/Migrations/2026-04-06-100000_Add_is_final_class_to_classes.php`

```php
// up():
$this->forge->addColumn('classes', [
    'is_final_class' => [
        'type'       => 'TINYINT',
        'constraint' => 1,
        'null'       => false,
        'default'    => 0,
        'after'      => 'next_class_id',
    ],
]);

// down():
$this->forge->dropColumn('classes', 'is_final_class');
```

### Invariants

- A class with `is_final_class = 1` SHOULD have `next_class_id = NULL`. The application enforces this: when `nextClassId` is set to a non-null value via the API, `is_final_class` is forced to `false`.
- A class with `is_final_class = 0` and `next_class_id = NULL` is considered unconfigured — promotion skips it with an error.
- A class with `is_final_class = 0` and `next_class_id` set is a normal promotable class.

---

## Entity: Class (updated)

| Field | API name | Notes |
|-------|----------|-------|
| `id` | `id` | UUID, PK |
| `tenant_id` | `tenantId` | FK to tenants, source of truth for isolation |
| `name` | `name` | Display name |
| `grade_level_id` | `gradeLevelId` | FK to grade_levels (nullable) |
| `stream` | `stream` | e.g., "A", "B" (nullable) |
| `teacher_id` | `teacherId` | FK to staff (nullable) |
| `next_class_id` | `nextClassId` | Self-referential FK; NULL unless configured (nullable) |
| `is_final_class` | `isFinalClass` | Boolean; true = graduation class |
| `capacity` | `capacity` | Integer |
| `archived_at` | `archivedAt` | Soft-delete timestamp (nullable) |

### State Transitions (promotion context)

```
is_final_class=false, next_class_id=NULL
        │
        │  Admin sets next_class_id
        ▼
is_final_class=false, next_class_id=<id>   ──(promote)──▶  student moves to next class
        │
        │  Admin clears next_class_id AND sets is_final_class=true
        ▼
is_final_class=true, next_class_id=NULL    ──(promote)──▶  student is graduated
```

---

## Entity: Enrollment (unchanged)

Status constants relevant to promotion:

| Status | Meaning |
|--------|---------|
| `active` | Student is currently enrolled; eligible for promotion |
| `promoted` | Student was promoted to next class; historical record |
| `graduated` | Student completed final class |
| `repeated` | Student is repeating; excluded from bulk promotion |
| `transferred` | Student transferred; excluded |
| `dropped_out` | Student dropped out; excluded |

---

## Entity: Student (unchanged)

`class_id` and `current_enrollment_id` are updated atomically during each promotion inside a DB transaction in `EnrollmentModel::promoteStudent()`.
