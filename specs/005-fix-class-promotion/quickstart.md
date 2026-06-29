# Quickstart: Fix Class Promotion Logic

**Branch**: `005-fix-class-promotion`

## What changed and why

Before this fix, any class with `next_class_id = NULL` was treated as a graduation/final class, so students in newly created or unconfigured classes were accidentally graduated instead of being held back and reported as skipped. This fix adds an explicit `is_final_class` flag so the system can tell the difference.

## Getting the environment running

```bash
# Backend
cd backend
composer install
php spark migrate           # applies the new 2026-04-06-100000 migration
php spark db:seed CompleteDatabaseSeeder   # includes is_final_class fix for class_005

# Frontend
cd frontend
npm install
npm run dev
```

Default credentials: `admin@greenwood.co.zw` / `1234`

## Verifying the fix

### 1. Confirm the migration ran

```sql
SHOW COLUMNS FROM classes LIKE 'is_final_class';
-- Should return one row with Type=tinyint(1), Default=0
```

### 2. Mark a class as final via the API

```bash
curl -X PUT http://localhost:8080/api/classes/class_005/next-class \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nextClassId": null, "isFinalClass": true}'
# Response should include "isFinalClass": true
```

### 3. Run a bulk promotion preview

```bash
curl http://localhost:8080/api/students/promotion-preview \
  -H "Authorization: Bearer <token>"
# class_005 should show action: "graduate"
# Any class without next_class_id and is_final_class=false should show action: "skip"
```

### 4. Run the bulk promotion

```bash
curl -X POST http://localhost:8080/api/students/promote \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
# Promoted count should match classes with next_class_id set
# Graduated count should match classes with is_final_class=true
# Skipped count should match classes with is_final_class=false AND next_class_id=null
```

### 5. In the UI

Open the Classes page → Edit any class → the edit form now includes a "Final class (graduation)" checkbox. Checking it and saving sets `is_final_class = true` and clears `next_class_id`.

## Key files changed

| File | Change |
|------|--------|
| `backend/app/Database/Migrations/2026-04-06-100000_Add_is_final_class_to_classes.php` | New migration adding `is_final_class` column |
| `backend/app/Models/ClassModel.php` | `isFinalClass()` reads `is_final_class`; `allowedFields` + `formatForApi`/`formatFromApi` updated |
| `backend/app/Controllers/Api/ClassController.php` | `setNextClass()` accepts `isFinalClass`; response includes it |
| `backend/app/Controllers/Api/StudentController.php` | `promoteStudentsFromClass()` error message improved; `promoteStudent()` graduates final-class students |
| `backend/app/Database/Seeds/CompleteDatabaseSeeder.php` | `class_005` marked `is_final_class = 1` |
| `frontend/src/api/api.ts` | `updateClass()` / `setNextClass()` sends `isFinalClass` |
| `frontend/src/components/modals/EditClassModal.tsx` | "Final class" checkbox added |
