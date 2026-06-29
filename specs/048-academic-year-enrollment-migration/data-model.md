# Data Model: Academic Year Class Migration via Enrollment History

**Feature**: `048-academic-year-enrollment-migration`  
**Date**: 2026-04-27

---

## Existing Tables (Modified)

### `enrollments` — Add `class_instance_id` column

**Change**: Add one nullable FK column. No existing columns removed or renamed.

```sql
-- Migration: 2026-04-27-100000_Add_class_instance_id_to_enrollments.php
ALTER TABLE enrollments
  ADD COLUMN class_instance_id VARCHAR(50) NULL AFTER class_id,
  ADD INDEX idx_enrollments_class_instance_id (class_instance_id);

-- FK added after class_instances table exists:
ALTER TABLE enrollments
  ADD CONSTRAINT fk_enrollments_class_instance
  FOREIGN KEY (class_instance_id) REFERENCES class_instances(id)
  ON DELETE SET NULL ON UPDATE CASCADE;
```

**Transition rules**:
- Pre-feature enrollments: `class_id` set, `class_instance_id` NULL → backward-compatible reads use `class_id`.
- Post-feature enrollments created by migration engine: both `class_instance_id` AND `class_id` set (class_id = class_instances.class_id for legacy readers).
- Reads in `EnrollmentModel::getStudentHistory()` join via `class_instance_id` when present, fall back to `class_id`.

---

## New Tables

### `class_instances`

Represents the concrete class for a specific academic year — the intersection of a class template (`classes` row) and an academic year string.

```sql
-- Migration: 2026-04-27-090000_Create_class_instances_table.php
CREATE TABLE class_instances (
  id             VARCHAR(50)  NOT NULL,
  tenant_id      VARCHAR(50)  NOT NULL,
  class_id       VARCHAR(50)  NOT NULL,          -- FK → classes.id (the "template")
  academic_year  VARCHAR(20)  NOT NULL,           -- e.g. "2025/2026"
  teacher_id     VARCHAR(50)  NULL,               -- year-specific override; NULL = inherit from class
  capacity       INT          NOT NULL DEFAULT 30, -- year-specific override
  is_final_class TINYINT(1)   NOT NULL DEFAULT 0, -- year-specific override
  created_at     DATETIME     NULL,
  updated_at     DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_class_instances_template_year (tenant_id, class_id, academic_year),
  KEY idx_class_instances_tenant_year (tenant_id, academic_year),
  CONSTRAINT fk_class_instances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_class_instances_class  FOREIGN KEY (class_id)  REFERENCES classes(id)  ON DELETE CASCADE ON UPDATE CASCADE
);
```

**Fields**:

| Field | Type | Notes |
|-------|------|-------|
| `id` | VARCHAR(50) | Generated: `ci_` prefix + uniqid |
| `tenant_id` | VARCHAR(50) | Tenant scope — NON-NEGOTIABLE |
| `class_id` | VARCHAR(50) | FK to `classes.id` (the template) |
| `academic_year` | VARCHAR(20) | String: "2025/2026" |
| `teacher_id` | VARCHAR(50) NULL | Overrides `classes.teacher_id` for this year |
| `capacity` | INT | Overrides `classes.capacity` for this year |
| `is_final_class` | TINYINT(1) | Overrides `classes.is_final_class` for this year |
| `created_at` | DATETIME NULL | CI auto-timestamp |
| `updated_at` | DATETIME NULL | CI auto-timestamp |

**Unique constraint**: A tenant can have at most one class instance per template per year.

---

### `class_progression_mappings` (P3 — optional, created now for forward compatibility)

Override table for non-linear promotion paths. Consulted before `classes.next_class_id`.

```sql
-- Migration: 2026-04-27-100001_Create_class_progression_mappings_table.php
CREATE TABLE class_progression_mappings (
  id                    VARCHAR(50)  NOT NULL,
  tenant_id             VARCHAR(50)  NOT NULL,
  source_class_id       VARCHAR(50)  NOT NULL,   -- FK → classes.id
  stream                VARCHAR(50)  NULL,         -- NULL = applies to all streams of this class
  destination_class_id  VARCHAR(50)  NOT NULL,   -- FK → classes.id
  created_at            DATETIME     NULL,
  updated_at            DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_progression_source_stream (tenant_id, source_class_id, stream),
  KEY idx_progression_tenant (tenant_id),
  CONSTRAINT fk_progression_tenant  FOREIGN KEY (tenant_id)            REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_progression_source  FOREIGN KEY (source_class_id)      REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_progression_dest    FOREIGN KEY (destination_class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE
);
```

**Fields**:

| Field | Type | Notes |
|-------|------|-------|
| `id` | VARCHAR(50) | Generated: `cpm_` prefix |
| `tenant_id` | VARCHAR(50) | Tenant scope |
| `source_class_id` | VARCHAR(50) | Which class template triggers this mapping |
| `stream` | VARCHAR(50) NULL | Optional: only applies when enrollment's class has this stream. NULL = wildcard |
| `destination_class_id` | VARCHAR(50) | Where to promote to |

**Resolution precedence**: Specific stream match > wildcard (stream IS NULL) > `classes.next_class_id` fallback.

---

## Data Migration Script (One-Time Backfill)

A dedicated migration creates `class_instances` rows for all unique `(class_id, academic_session)` pairs already existing in the `enrollments` table, then backfills `enrollments.class_instance_id`.

```sql
-- Migration: 2026-04-27-100002_Backfill_class_instances_from_enrollments.php

-- Step 1: Create one class_instance per unique (class_id, academic_session) in existing enrollments
INSERT IGNORE INTO class_instances (id, tenant_id, class_id, academic_year, teacher_id, capacity, is_final_class, created_at, updated_at)
SELECT
  CONCAT('ci_legacy_', MD5(CONCAT(e.class_id, '_', e.academic_session))) AS id,
  e.tenant_id,
  e.class_id,
  e.academic_session                                                       AS academic_year,
  c.teacher_id,
  c.capacity,
  c.is_final_class,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT tenant_id, class_id, academic_session FROM enrollments
) e
JOIN classes c ON c.id = e.class_id;

-- Step 2: Backfill class_instance_id on all existing enrollments
UPDATE enrollments e
JOIN class_instances ci
  ON ci.class_id = e.class_id AND ci.academic_year = e.academic_session AND ci.tenant_id = e.tenant_id
SET e.class_instance_id = ci.id
WHERE e.class_instance_id IS NULL;
```

---

## Existing Tables (Unchanged)

### `classes` — The "template" layer (no structural changes)

Current columns (fully sufficient as a template store):

| Column | Type | Role in this feature |
|--------|------|----------------------|
| `id` | VARCHAR(50) | FK target from `class_instances.class_id` |
| `tenant_id` | VARCHAR(50) | Tenant isolation |
| `name` | VARCHAR(100) | Template display name |
| `grade_level_id` | VARCHAR(50) NULL | Group membership |
| `stream` | VARCHAR(50) NULL | Used by progression mapping lookup |
| `teacher_id` | VARCHAR(50) NULL | Default teacher (overridable per instance) |
| `capacity` | INT | Default capacity (overridable per instance) |
| `next_class_id` | VARCHAR(50) NULL | Default promotion target (FK self-ref) |
| `is_final_class` | TINYINT(1) | Default graduation flag (overridable per instance) |
| `archived_at` | DATETIME NULL | Archived templates cannot generate new instances |

**No changes** to this table in this feature.

---

### `enrollments` — Current state (reference)

Key existing columns:

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | |
| `tenant_id` | VARCHAR(50) | |
| `student_id` | VARCHAR(50) | |
| `class_id` | VARCHAR(50) | Legacy — retained for backward compat |
| **`class_instance_id`** | **VARCHAR(50) NULL** | **NEW — added by this feature** |
| `academic_session` | VARCHAR(20) | e.g. "2025/2026" — retained |
| `status` | ENUM | ACTIVE / PROMOTED / REPEATED / GRADUATED / TRANSFERRED / DROPPED_OUT / INACTIVE |
| `enrollment_date` | DATE | |
| `completion_date` | DATE NULL | Set when status transitions to non-ACTIVE |
| `remarks` | TEXT NULL | |

---

### `students` — Unchanged (backward-compat fields retained)

| Column | Notes |
|--------|-------|
| `class_id` | Updated post-migration to point to the new class instance's `class_id` (unchanged behaviour) |
| `current_enrollment_id` | Updated post-migration to point to the new ACTIVE enrollment |

---

## Entity Relationship Summary

```
tenants (1) ──────────────────────────── (N) classes [templates]
                                               │
                                               │ FK class_id
                                               ▼
tenants (1) ──── (N) class_instances ◄─── classes.id
                        │  academic_year
                        │
                        │ FK class_instance_id
                        ▼
tenants (1) ──── (N) enrollments ◄────── students
                        │ academic_session
                        │ status: ACTIVE → PROMOTED/REPEATED/GRADUATED/...

classes ──── (N) class_progression_mappings (optional override for next class)
```

---

## State Transitions

### Enrollment Status State Machine

```
          [initial enrollment]
                  │
                  ▼
               ACTIVE
             /    |    \    \
            /     |     \    \
    PROMOTED  REPEATED  GRADUATED  TRANSFERRED / DROPPED_OUT / INACTIVE
       │          │
       │          │  (same class template, next academic year)
       ▼          ▼
    new ACTIVE enrollment created for next academic_year
```

### Migration Engine Decision Tree (per student)

```
For each ACTIVE enrollment in current academic year:
  └─ Is student.status = 'repeating'?
       YES → close enrollment as REPEATED
             → create new enrollment for (same class template, next year)
       NO  → Is class instance's is_final_class = 1?
               YES → close enrollment as GRADUATED
                     → update student.status = 'graduated'
                     → no new enrollment created
               NO  → Lookup progression_mapping for (class_id, stream)
                       FOUND → destination = mapping.destination_class_id
                       NOT FOUND → destination = classes.next_class_id
                       NEITHER → SKIP, add to skipped list with reason
                     → create class_instance for (destination, next_year) if missing
                     → close enrollment as PROMOTED
                     → create new ACTIVE enrollment for (destination_instance, next_year)
                     → update student.class_id + current_enrollment_id
```

---

## Model Changes Summary

| Model | Change |
|-------|--------|
| `ClassModel` | No structural changes. `formatForApi()` and `formatFromApi()` unchanged. |
| `EnrollmentModel` | `$allowedFields` gains `class_instance_id`. `getStudentHistory()` updated to join via `class_instance_id` when available. New method: `getActiveByInstanceId()`. |
| `ClassInstanceModel` | **NEW** — full CRUD model for `class_instances` table. |
| `ClassProgressionMappingModel` | **NEW** — CRUD model for `class_progression_mappings` table. |
| `ClassMigrationService` | **NEW** — service class containing dry-run and commit migration logic. |
