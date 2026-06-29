# Quickstart: Academic Year Class Migration via Enrollment History

**Feature**: `048-academic-year-enrollment-migration`  
**Date**: 2026-04-27

---

## Prerequisites

1. Backend running (`./backend/start.sh` or equivalent)
2. MySQL migrations applied through the latest existing migration
3. At least one tenant with active classes, students, and enrollments (use the seeder)

---

## Step 1: Run the New Migrations

Apply migrations in order (timestamps determine order, CI4 runs them sequentially):

```bash
cd backend
php spark migrate
```

New migrations applied by this feature (in order):
1. `2026-04-27-090000_Create_class_instances_table` — creates `class_instances` table
2. `2026-04-27-100000_Add_class_instance_id_to_enrollments` — adds `class_instance_id` to `enrollments`
3. `2026-04-27-100001_Create_class_progression_mappings_table` — creates `class_progression_mappings` table
4. `2026-04-27-100002_Backfill_class_instances_from_enrollments` — backfills legacy data (idempotent)

---

## Step 2: Verify Backfill

After migration, verify the backfill succeeded:

```sql
-- Should return 0 rows (all legacy enrollments now have a class_instance_id)
SELECT COUNT(*) FROM enrollments WHERE class_instance_id IS NULL;

-- Should return one row per unique (class_id, academic_session) pair
SELECT class_id, academic_year, COUNT(*) as instances
FROM class_instances
GROUP BY class_id, academic_year;
```

---

## Step 3: Generate Instances for Next Academic Year

Using the API (replace token and year as needed):

```bash
curl -X POST http://localhost:8080/api/class-instances/generate \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"academicYear": "2026/2027"}'
```

Expected response includes `created: N` (one per active class template) and `existing: 0` on first run.

---

## Step 4: Run Migration Dry-Run (Preview)

```bash
curl -X POST http://localhost:8080/api/class-migration/preview \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAcademicYear": "2025/2026",
    "toAcademicYear": "2026/2027"
  }'
```

Review the `summary` and `skippedStudents` arrays. Address any unconfigured classes before running the actual migration.

---

## Step 5: Execute Year-End Migration

```bash
curl -X POST http://localhost:8080/api/class-migration/run \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAcademicYear": "2025/2026",
    "toAcademicYear": "2026/2027",
    "confirm": true
  }'
```

Verify the response summary matches the preview. All previously ACTIVE enrollments should now have a terminal status.

---

## Step 6: Verify Results

```sql
-- No ACTIVE enrollments should remain for the old year
SELECT COUNT(*) FROM enrollments
WHERE academic_session = '2025/2026' AND status = 'ACTIVE';
-- Expected: 0

-- New ACTIVE enrollments should exist for next year
SELECT COUNT(*) FROM enrollments
WHERE academic_session = '2026/2027' AND status = 'ACTIVE';
-- Expected: (promoted_count + repeated_count)

-- Students with class_id and current_enrollment_id should be updated
SELECT s.id, s.class_id, e.academic_session, e.status
FROM students s
JOIN enrollments e ON e.id = s.current_enrollment_id
WHERE s.status = 'active'
LIMIT 10;
```

---

## Running Integration Tests

```bash
cd backend
php spark test --filter ClassMigrationTest
```

Key test scenarios covered:
- Happy path: full migration with promote/repeat/graduate mix
- Idempotency: running migration twice produces no new rows
- Dry-run accuracy: preview matches actual migration outcome
- Skipped students: unconfigured class produces skip with reason
- Tenant isolation: migration only affects the authenticated tenant's enrollments
- Transaction rollback: forced failure leaves database unchanged

---

## Rollback a Migration (Development Only)

```bash
cd backend
php spark migrate:rollback --batch 1
```

This rolls back all four new migrations in reverse order. The backfill migration's `down()` removes the `class_instance_id` column and drops the `class_instances` table — existing enrollment data is preserved, only the new FK column is removed.

> **Warning**: Rolling back in production removes the `class_instance_id` column and any class_instances data. Only do this in development before any real migration has been run.
