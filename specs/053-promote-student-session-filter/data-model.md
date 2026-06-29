# Data Model: Promote Student – Session-Scoped Preview & Filtering

**Feature**: `053-promote-student-session-filter`  
**Date**: 2026-04-29

---

## Overview

This feature introduces no new tables and no schema changes. It refines how existing entities are **queried** during the promotion preview and bulk promotion flow by adding a session-scope filter to the student eligibility query.

---

## Existing Entities Involved

### `students`

| Column | Type | Relevance |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant isolation |
| `class_id` | UUID (FK → classes.id) | Current class assignment |
| `status` | ENUM: `active`, `repeating`, `inactive`, `graduated`, `transferred` | Must be `active` to be eligible |
| `current_enrollment_id` | UUID (FK → enrollments.id) | Points to the enrollment record used as the join anchor |

### `enrollments`

| Column | Type | Relevance |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant isolation |
| `student_id` | UUID (FK → students.id) | Links to student |
| `class_id` | UUID (FK → classes.id) | Class for this enrollment period |
| `academic_session` | VARCHAR | **New filter dimension** — format `YYYY/YYYY+1` |
| `status` | ENUM: `ACTIVE`, `PROMOTED`, `REPEATED`, `GRADUATED`, `TRANSFERRED`, `DROPPED_OUT`, `INACTIVE` | Must be `ACTIVE` to be eligible |
| `enrollment_date` | DATE | — |
| `completion_date` | DATE | Set on promotion/graduation |
| `remarks` | TEXT | Audit trail |

### `classes`

| Column | Type | Relevance |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | Multi-tenant isolation |
| `next_class_id` | UUID (nullable FK → classes.id) | Determines promotion target |
| `is_final_class` | TINYINT(1) | If 1, students graduate rather than promote |

---

## Eligibility Rule (Updated)

A student is eligible for the bulk promotion run if and only if **all** of the following hold:

1. `students.status = 'active'`
2. The enrollment record referenced by `students.current_enrollment_id` has `enrollments.status = 'ACTIVE'`
3. **NEW** — The same enrollment record has `enrollments.academic_session = <currentAcademicSession>`

Condition 3 is the addition introduced by this feature. It ensures that students whose most recent active enrollment belongs to a prior or future session are excluded from the current promotion run.

---

## Query Change (Conceptual)

**Before** (`ClassModel::getStudentsForPromotion`):
```sql
SELECT students.*
FROM students
JOIN enrollments ON students.current_enrollment_id = enrollments.id
WHERE students.class_id = :classId
  AND students.status = 'active'
  AND enrollments.status = 'ACTIVE'
```

**After** (with session filter applied):
```sql
SELECT students.*
FROM students
JOIN enrollments ON students.current_enrollment_id = enrollments.id
WHERE students.class_id = :classId
  AND students.status = 'active'
  AND enrollments.status = 'ACTIVE'
  AND enrollments.academic_session = :academicSession  -- NEW
```

The `:academicSession` parameter is the value resolved by `AcademicSessionService::getCurrentSession($tenantId)` at the time the preview or bulk promotion is initiated.

---

## State Transitions (Unchanged)

The promotion and graduation state transitions are unchanged:

```
Enrollment(ACTIVE, session=S)  ──promote──▶  Enrollment(PROMOTED, session=S)
                                              + new Enrollment(ACTIVE, session=S+1)

Enrollment(ACTIVE, session=S)  ─graduate─▶  Enrollment(GRADUATED, session=S)
                                              student.status = 'graduated'
```

---

## No Migration Required

The `enrollments.academic_session` column already exists and is populated on every `enrollStudent()` call. No DDL changes are needed.
