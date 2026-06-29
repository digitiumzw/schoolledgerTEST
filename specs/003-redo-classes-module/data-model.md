# Data Model: Classes Module Redesign

**Branch**: `003-redo-classes-module` | **Date**: 2026-04-03

---

## New Table: `grade_levels`

Represents a formal academic grade or year in the school (e.g., "Grade 1", "Form 3").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(50) | PK | Prefixed unique ID (`gl{timestamp}_{hex}`) |
| `tenant_id` | VARCHAR(50) | NOT NULL, FK→tenants.id CASCADE | Multi-tenant isolation |
| `name` | VARCHAR(100) | NOT NULL | Display name (e.g., "Grade 7", "Form 3") |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | Administrator-defined display sequence |
| `created_at` | DATETIME | nullable | CI4 timestamp |
| `updated_at` | DATETIME | nullable | CI4 timestamp |

**Indexes**:
- PRIMARY KEY (`id`)
- INDEX (`tenant_id`)
- UNIQUE (`tenant_id`, `name`) — grade level names unique per school

**Relationships**:
- `grade_levels.tenant_id` → `tenants.id` (CASCADE DELETE, CASCADE UPDATE)
- One `grade_levels` row → many `classes` rows (via `classes.grade_level_id`)

---

## Modified Table: `classes`

Two new nullable columns added via migration. Existing columns and constraints unchanged.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(50) | PK | Existing |
| `tenant_id` | VARCHAR(50) | NOT NULL, FK→tenants.id | Existing |
| `name` | VARCHAR(100) | NOT NULL | Existing — stream label or full class name |
| `teacher_id` | VARCHAR(50) | nullable, FK→staff.id | Existing — homeroom teacher |
| `capacity` | INT | NOT NULL, DEFAULT 30 | Existing |
| `next_class_id` | VARCHAR(50) | nullable, FK→classes.id | Existing — promotion target |
| `archived_at` | DATETIME | nullable | Existing — soft delete |
| **`grade_level_id`** | VARCHAR(50) | **nullable**, FK→grade_levels.id SET NULL | **New** — owning grade level |
| **`stream`** | VARCHAR(50) | **nullable** | **New** — stream label within grade (e.g., "A", "Science") |
| `created_at` | DATETIME | nullable | Existing |
| `updated_at` | DATETIME | nullable | Existing |

**New indexes**:
- INDEX (`grade_level_id`)
- UNIQUE (`tenant_id`, `grade_level_id`, `stream`) — stream names unique per grade per school (partial: only enforced when both `grade_level_id` and `stream` are non-null)

**FK behaviour on `grade_level_id`**: SET NULL — deleting a grade level does not cascade-delete its classes; they become "ungrouped".

---

## Existing Tables (unchanged schema)

### `enrollments`

No schema changes. Existing statuses (`ACTIVE`, `PROMOTED`, `REPEATED`, `GRADUATED`, `TRANSFERRED`, `DROPPED_OUT`, `INACTIVE`) cover all spec requirements.

### `students`

No schema changes required for this module. The `status = 'repeating'` value on `students.status` is used by the promotion logic to exclude students from bulk promotion (FR-011).

---

## Entity Relationships

```
tenants (1)
  └── grade_levels (many)     [tenant_id FK]
        └── classes (many)    [grade_level_id FK, nullable]
              ├── classes (self-ref: next_class_id)  [promotion chain]
              ├── enrollments (many)                 [class_id FK]
              └── students (many)                    [class_id on student]

staff (1)
  └── classes (many via teacher_id)   [homeroom teacher assignment]
```

---

## State Machines

### Class Lifecycle

```
          [create]
              │
           ACTIVE ◄──────────────────────────────────────────┐
              │                                              │
         [archive] (only if 0 active students)         [unarchive]
              │                                              │
           ARCHIVED ──────────────────────────────────────────┘
              │
     [permanent delete] (only if 0 enrollment history)
              │
           (removed)
```

### Enrollment Status Transitions

```
ACTIVE ──[promote]──► PROMOTED
ACTIVE ──[graduate]─► GRADUATED
ACTIVE ──[transfer]─► TRANSFERRED
ACTIVE ──[repeat]───► REPEATED   (old enrollment closed; new ACTIVE enrollment created in same class)
ACTIVE ──[drop out]─► DROPPED_OUT
```

---

## Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| GradeLevel | `name` | Required, max 100 chars, unique per tenant |
| GradeLevel | `sort_order` | Integer ≥ 0; defaults to current max + 1 |
| Class | `name` | Required, max 100 chars |
| Class | `stream` | Optional, max 50 chars; when `grade_level_id` is set, (`grade_level_id`, `stream`) must be unique per tenant |
| Class | `capacity` | Integer 1–999; default 30 |
| Class | `grade_level_id` | Optional FK; must belong to same tenant when provided |
| Class | `next_class_id` | Optional FK; must not create a promotion cycle; must belong to same tenant |
| Class | archive | Blocked when active student count > 0 |
| Class | permanent delete | Blocked when any enrollment history exists |

---

## API Shape Changes

### `GET /api/classes` — response item (extended)

```json
{
  "id": "c1234_abc",
  "tenantId": "t1",
  "name": "7A",
  "stream": "A",
  "gradeLevelId": "gl1234_xyz",
  "gradeLevel": { "id": "gl1234_xyz", "name": "Grade 7", "sortOrder": 7 },
  "teacherId": "s1_abc",
  "capacity": 35,
  "studentCount": 28,
  "nextClassId": null,
  "nextClass": null,
  "isFinalClass": true,
  "archivedAt": null
}
```

### `GET /api/grade-levels` — response item

```json
{
  "id": "gl1234_xyz",
  "tenantId": "t1",
  "name": "Grade 7",
  "sortOrder": 7,
  "classCount": 2,
  "createdAt": "2026-04-03T10:00:00Z"
}
```
