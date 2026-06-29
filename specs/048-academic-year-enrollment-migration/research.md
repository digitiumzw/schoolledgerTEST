# Research: Academic Year Class Migration via Enrollment History

**Feature**: `048-academic-year-enrollment-migration`  
**Date**: 2026-04-27  
**Status**: Complete — all unknowns resolved

---

## 1. Current Data Model State

### Decision: Keep `classes` table as the "template" layer — no rename, additive migration only

**Rationale**: The existing `classes` table already contains `name`, `grade_level_id`, `stream`, `next_class_id`, `is_final_class`, `capacity`, `teacher_id`, `archived_at`, and `tenant_id`. This is structurally identical to the `class_templates` concept from the spec. Renaming the table would require touching every FK, migration, model, controller, query, and frontend reference — a high-risk operation with zero functional gain.

**Decision**: The `classes` table **is** the class template table. No rename. New columns (`is_template = 1` flag or separate table) are not needed — the existing table serves the template role.

**Alternatives considered**: Creating a new `class_templates` table and migrating `classes` data into it. Rejected due to the large blast radius across all existing migrations, foreign keys, models, and controllers.

---

## 2. Class Instances: New Table Required

### Decision: Introduce `class_instances` table — new additive table, no existing tables modified

**Rationale**: The spec requires a template × academic_year intersection entity. Nothing in the existing schema fulfils this. The `classes` table records do not carry an `academic_year_id`. A new `class_instances` table is the minimal additive change.

**Schema**:
```sql
class_instances (
  id             VARCHAR(50) PK,
  tenant_id      VARCHAR(50) NOT NULL FK → tenants.id,
  class_id       VARCHAR(50) NOT NULL FK → classes.id (the template),
  academic_year  VARCHAR(20) NOT NULL,  -- matches enrollments.academic_session format e.g. "2025/2026"
  teacher_id     VARCHAR(50) NULL,      -- override of classes.teacher_id for this year
  capacity       INT NOT NULL DEFAULT 30, -- override of classes.capacity for this year
  is_final_class TINYINT(1) DEFAULT 0,  -- override of classes.is_final_class for this year
  created_at     DATETIME NULL,
  updated_at     DATETIME NULL,
  UNIQUE (tenant_id, class_id, academic_year)
)
```

**Alternatives considered**: Embedding `academic_year` directly onto `classes` as a denormalised column — rejected because it would break the template concept and duplicate rows.

---

## 3. Enrollment FK: Additive Column, Not a Replace

### Decision: Add `class_instance_id` to `enrollments` as a nullable FK alongside existing `class_id`

**Rationale**: Immediately replacing `class_id` with `class_instance_id` would break every existing query, model method, API endpoint, and frontend that reads `class_id` from an enrollment. The safer path is additive: new enrollments set `class_instance_id`; old ones retain only `class_id`. A read-compatibility layer in the model resolves the class name from whichever column is populated.

**Transition rule**:
- Legacy enrollments (pre-feature): `class_id` set, `class_instance_id` NULL.
- New enrollments (post-feature migration): `class_instance_id` set; `class_id` set to the same `class_instance.class_id` for backward compatibility with existing reads.

**Migration script**: A one-time data migration creates a `class_instance` row per unique `(class_id, academic_session)` pair found in the existing `enrollments` table, then backfills `class_instance_id` on those rows.

**Alternatives considered**: Hard-cutting over to `class_instance_id` only. Rejected — too large a blast radius in a single release.

---

## 4. Academic Year Representation

### Decision: Reuse existing `academic_session` VARCHAR format ("2025/2026") — no new `academic_years` table in this release

**Rationale**: The existing schema uses `academic_session VARCHAR(20)` on enrollments and the `settings.academic_year` field. There is no dedicated `academic_years` table — the value is stored as a plain string. Creating a full `academic_years` table is out of scope; the spec assumption acknowledges this.

**For class instances**: `class_instances.academic_year` stores the same string format. The migration engine derives the "next year" string arithmetically: `"2025/2026"` → `"2026/2027"`.

**Validation**: The migration engine reads the current `academic_session` from `tenants.academic_year` (the authoritative active year per tenant, already used by the billing and charge generation modules). If blank, migration is blocked with a clear error.

**Alternatives considered**: FK to a new `academic_years` table. Deferred to a future spec; out of scope here per spec Assumption 2.

---

## 5. Class Progression Mapping (P3)

### Decision: Introduce `class_progression_mappings` table, consulted first before `classes.next_class_id`

**Rationale**: Simple schools use `next_class_id` on the class template (already exists). Schools with streams/branching need a mapping override. Storing this as a separate table keeps the core template clean.

**Schema**:
```sql
class_progression_mappings (
  id                    VARCHAR(50) PK,
  tenant_id             VARCHAR(50) NOT NULL FK → tenants.id,
  source_class_id       VARCHAR(50) NOT NULL FK → classes.id,
  stream                VARCHAR(50) NULL,
  destination_class_id  VARCHAR(50) NOT NULL FK → classes.id,
  created_at            DATETIME NULL,
  updated_at            DATETIME NULL,
  UNIQUE (tenant_id, source_class_id, stream)
)
```

**Resolution order in migration engine** (FR-009):
1. Query `class_progression_mappings` WHERE `source_class_id = :classId AND tenant_id = :tenantId AND (stream = :stream OR stream IS NULL)` ORDER BY stream DESC (specific match wins over wildcard)
2. Fall back to `classes.next_class_id`
3. Skip + flag

---

## 6. Student Outcome Determination (Repeating)

### Decision: Use `students.status = 'repeating'` as the per-student signal for REPEATED outcome

**Rationale**: The existing `students.status` ENUM already includes `'active'` and `'repeating'` (plus `'graduated'`, `'transferred'`, `'dropped_out'`, `'inactive'`). The `status = 'repeating'` flag is already used by `ClassModel::getStudentsForPromotion()` to exclude repeating students from the standard promotion batch. The migration engine interprets this as: close enrollment with REPEATED status, create new enrollment in the same class template's instance for the next year.

**Alternatives considered**: A separate `repeat_flag` boolean on enrollments — redundant with the existing student status field.

---

## 7. Migration Engine: New Service Class

### Decision: Implement `ClassMigrationService` as a standalone service class

**Rationale**: The existing `StudentController::promote()` method is already long (~200 lines) and handles both single-student and bulk flows mixed with HTTP concerns. The year-end migration is a fundamentally different operation (operates on academic-year boundaries, creates class instances, handles dry-run). Extracting it to a service class keeps controllers thin (Principle II) and makes the logic independently testable (Principle X).

**Location**: `backend/app/Services/ClassMigrationService.php`

**Alternatives considered**: Extending `StudentController` with more methods — rejected, controller already large.

---

## 8. New Controller: `ClassMigrationController`

### Decision: New dedicated controller for migration and class instance endpoints

**Rationale**: Migration endpoints are conceptually distinct from CRUD class/student management. Mixing them into `ClassController` or `StudentController` would further bloat already-large controllers. A dedicated controller with 4–5 endpoints is clean and adheres to API-First principles (Principle II).

**Routes to add**:
```
POST   /api/class-migration/preview          → dry-run
POST   /api/class-migration/run              → actual migration
GET    /api/class-instances                  → list instances for a year
POST   /api/class-instances/generate         → bulk generate instances for a year
GET    /api/class-instances/:id/students     → students in a specific instance
POST   /api/class-progression-mappings       → create/update mapping (P3)
GET    /api/class-progression-mappings       → list mappings (P3)
DELETE /api/class-progression-mappings/:id   → delete mapping (P3)
```

---

## 9. Frontend: Migration UI Integration Point

### Decision: Add migration trigger to the existing `Classes` page via a new "Year-End Migration" panel/tab

**Rationale**: The `Classes.tsx` page is the natural home for administrative class operations. A dedicated modal or collapsible panel for "Year-End Migration" avoids creating a brand-new route. The dry-run preview result is displayed before the admin confirms the actual run — mirroring the billing preview pattern already used in the billing module.

**New frontend components**:
- `YearEndMigrationPanel.tsx` — top-level panel with trigger and results display
- `MigrationPreviewTable.tsx` — table showing per-class outcomes before confirming
- `ClassInstancesTab.tsx` (P2) — tab on Classes page showing instances by year

**New hooks**:
- `useClassMigration.ts` — wraps preview and run endpoints

**Existing components updated**:
- `Classes.tsx` — gains "Year-End Migration" trigger button / panel

---

## 10. ID Generation Pattern

### Decision: Follow existing `generateId()` pattern from `BaseApiController`

**Rationale**: All existing entities use `$this->generateId('prefix')` which generates UUID-style IDs with a recognisable prefix. Class instances use `'ci'` prefix; progression mappings use `'cpm'` prefix.

---

## 11. Idempotency Guard

### Decision: Use UNIQUE constraint on `(tenant_id, class_id, academic_year)` in `class_instances` for idempotency

**Rationale**: The DB-level unique constraint is the strongest idempotency guarantee. The migration engine uses `INSERT IGNORE` / upsert semantics when auto-creating instances, and checks for existing ACTIVE enrollments with the same `(student_id, class_instance_id)` before inserting new ones.

---

## 12. Backward Compatibility with Existing Promotion Flow

### Decision: Existing `POST /api/students/promote` endpoint is retained and continues to function

**Rationale**: The existing promotion endpoint works on the `classes.next_class_id` chain and creates enrollments with the legacy `class_id` field. It remains available for mid-year manual promotions. The new `ClassMigrationController` handles the structured year-end migration flow. Both can coexist during the transition period. The new migration engine additionally sets `class_instance_id` on enrollments it creates.
