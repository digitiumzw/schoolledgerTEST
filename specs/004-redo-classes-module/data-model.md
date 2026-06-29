# Data Model: Redo Classes Module

**Branch**: `004-redo-classes-module` | **Date**: 2026-04-06

## Entities

### grade_levels

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | VARCHAR(50) | PK | UUID generated at insert |
| tenant_id | VARCHAR(50) | NOT NULL, FK → tenants.id CASCADE | Isolation boundary |
| name | VARCHAR(100) | NOT NULL | e.g., "Form 1", "Grade 7" |
| sort_order | INT | NOT NULL, DEFAULT 0 | Display ordering |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

**Unique constraint**: `(tenant_id, name)` — a grade level name must be unique within a tenant.

**Business rules**:
- Cannot be deleted if it has classes with `grade_level_id` pointing to it.
- `sort_order` is auto-assigned (max + 1) if not provided on creation.
- `name` is trimmed and validated for non-empty on create/update.

---

### classes

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | VARCHAR(50) | PK | UUID generated at insert |
| tenant_id | VARCHAR(50) | NOT NULL, FK → tenants.id CASCADE | Isolation boundary |
| name | VARCHAR(100) | NOT NULL | e.g., "Form 1A", "7A" |
| grade_level_id | VARCHAR(50) | nullable, FK → grade_levels.id SET NULL | Linked grade level |
| stream | VARCHAR(50) | nullable | Differentiator within a grade, e.g., "A", "B", "Science" |
| teacher_id | VARCHAR(50) | nullable, FK → staff.id SET NULL | Designated class teacher |
| capacity | INT | NOT NULL, DEFAULT 30 | Maximum student count |
| next_class_id | VARCHAR(50) | nullable, FK → classes.id SET NULL | Promotion target |
| archived_at | DATETIME | nullable | NULL = active; non-NULL = soft-deleted |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

**Unique constraint (application-level)**: `(tenant_id, grade_level_id, name, stream)` — no two
classes in the same grade level for the same tenant can share both name and stream. Enforced in
`ClassController::validateGradeAndStream()` before create/update.

**Business rules**:
- A class with enrolled active students CANNOT be archived (soft-deleted).
- A class with any enrollment history (past or present) CANNOT be permanently deleted.
- `next_class_id` must not create a cycle in the promotion chain; cycle detection runs on set.
- `capacity` must be ≥ current active student count when lowering it (warn but do not block unless
  hard capacity enforcement is active).
- When `grade_level_id` is set, the grade level must belong to the same `tenant_id`.

---

### enrollments (read-only from classes module perspective)

The classes module reads but does not write to enrollments. Defined here for relationship clarity.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | PK |
| student_id | VARCHAR(50) | FK → students.id |
| class_id | VARCHAR(50) | FK → classes.id |
| tenant_id | VARCHAR(50) | FK → tenants.id |
| status | VARCHAR(20) | 'ACTIVE', 'INACTIVE', etc. — use EnrollmentModel::STATUS_ACTIVE constant |
| academic_session | VARCHAR(20) | e.g., "2025/2026" |
| enrolled_at | DATETIME | |
| left_at | DATETIME, nullable | |

**Relationship to classes module**:
- `ClassController::assignStudents()` writes enrollment records.
- `ClassController::students()` reads active enrollments for a class.
- `ClassController::getEnrollmentHistory()` checks for any enrollment records (any status).
- Uniqueness of `(student_id, class_id, status='ACTIVE')` enforced at enrollment time to prevent
  duplicates.

---

## Entity Relationships

```
tenants (1) ──── (N) grade_levels
tenants (1) ──── (N) classes
grade_levels (1) ──── (N) classes       [grade_level_id; nullable]
classes (1) ──── (0..1) classes         [next_class_id self-reference; nullable]
staff (1) ──── (N) classes              [teacher_id; nullable]
classes (1) ──── (N) enrollments
students (1) ──── (N) enrollments
```

## State Transitions: Class Lifecycle

```
                  ┌─────────────────────┐
    [create] ──→  │       ACTIVE        │  ←── [unarchive]
                  └─────────────────────┘
                           │
                      [archive]
                    (no active students)
                           │
                           ▼
                  ┌─────────────────────┐
                  │      ARCHIVED       │
                  └─────────────────────┘
                           │
                   [permanent delete]
                 (no enrollment history)
                           │
                           ▼
                        [gone]
```

## Validation Rules Summary

| Entity | Field | Rule |
|--------|-------|------|
| grade_levels | name | Required, non-empty, unique per tenant |
| grade_levels | sort_order | Auto-assigned if omitted; must be positive integer |
| classes | name | Required, non-empty |
| classes | grade_level_id | If provided, must belong to same tenant |
| classes | (name, stream) per grade_level | Must be unique within tenant + grade_level combination |
| classes | capacity | Must be positive integer; default 30 |
| classes | next_class_id | Must not create a cycle; must belong to same tenant |
| enrollments | student_id + class_id | Active enrollment must be unique per student |
