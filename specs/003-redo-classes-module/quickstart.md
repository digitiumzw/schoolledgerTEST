# Quickstart: Classes Module Redesign

**Branch**: `003-redo-classes-module` | **Date**: 2026-04-03

This guide explains how to get the redesigned Classes module running locally from scratch.

---

## Prerequisites

- MySQL running with the `schoolledger` database
- Backend `backend/.env` configured (see CLAUDE.md)
- Node.js + npm installed for the frontend

---

## 1. Run New Migrations (Backend)

```bash
cd backend
php spark migrate
```

This applies two new migrations in order:
1. `2026-04-03-120000_Create_grade_levels_table` — creates the `grade_levels` table
2. `2026-04-03-130000_Add_grade_fields_to_classes` — adds `grade_level_id` and `stream` to `classes`

Existing classes remain valid after migration — new columns are nullable, so no data loss occurs.

---

## 2. Seed Sample Data

```bash
php spark db:seed SampleDataSeeder
```

The seeder should create at least two grade levels and assign existing sample classes to them. If the seeder hasn't been updated yet, create grade levels manually via the UI or API after step 3.

---

## 3. Start the Backend

```bash
php spark serve
# Server running at http://localhost:8080
```

---

## 4. Start the Frontend

```bash
cd ../frontend
npm install   # only needed if dependencies changed
npm run dev
# Dev server at http://localhost:5173 (or the port Vite assigns)
```

---

## 5. Verify the Grade Level Feature

1. Log in as `admin@greenwood.co.zw` / `1234`
2. Navigate to **Classes**
3. Verify the class list shows classes grouped under grade level headers
4. Use the **+ Grade Level** button to create a new grade level
5. Create a class under that grade level with a stream label (e.g., "A")
6. Assign students and verify the capacity warning appears when the limit is reached

---

## 6. Verify Role Scoping

1. Log in as a teacher user
2. Navigate to **Classes**
3. Confirm only classes assigned to that teacher's homeroom are visible

---

## Key API Endpoints to Test Manually

```bash
# Get all grade levels
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/grade-levels

# Create a grade level
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Grade 7","sortOrder":7}' \
  http://localhost:8080/api/grade-levels

# Create a class under that grade level
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"7A","stream":"A","gradeLevelId":"<id>","capacity":35}' \
  http://localhost:8080/api/classes

# Assign students (will return 409 if capacity exceeded without force)
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"studentIds":["s1","s2"],"force":false}' \
  http://localhost:8080/api/classes/<classId>/assign-students

# Set next class (will return 400 if it creates a cycle)
curl -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"nextClassId":"<nextId>"}' \
  http://localhost:8080/api/classes/<classId>/next-class
```

---

## Rollback

To undo the schema changes without touching existing data:

```bash
cd backend
php spark migrate:rollback --batch 2   # rolls back the two new migrations only
```

This drops the `grade_level_id` and `stream` columns and the `grade_levels` table. Existing class data is preserved.
