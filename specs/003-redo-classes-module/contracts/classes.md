# API Contract: Classes (Extended)

**Resource**: `/api/classes`
**Auth**: JWT Bearer required on all endpoints (JWTAuthFilter)

This document covers **changes and additions** to the existing `/api/classes` contract. Unchanged endpoints are noted but not repeated in full.

---

## Changed: `GET /api/classes`

Two new fields added to each class object in the response. **Non-breaking** — existing consumers that ignore unknown fields are unaffected.

**New query params**:
| Param | Type | Description |
|-------|------|-------------|
| `gradeLevelId` | string | Filter classes to a specific grade level |
| `include_archived` | bool | Existing — unchanged |

**Role-scoped behaviour** (new):
- `teacher`: only returns classes where `teacher_id` matches the caller's staff record.
- `bursar`: returns all classes with `studentCount` and `capacity`; omits `students` list.
- `admin` / `super_admin`: full access, no change.

**Extended response item**:
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

---

## Changed: `POST /api/classes`

Two new optional fields in the request body.

**Extended request body**:
```json
{
  "name": "7A",
  "teacherId": "s1_abc",
  "capacity": 35,
  "nextClassId": null,
  "gradeLevelId": "gl1234_xyz",
  "stream": "A"
}
```

| Field | Required | Type | Rules |
|-------|----------|------|-------|
| `name` | yes | string | max 100 chars |
| `gradeLevelId` | no | string | FK to grade_levels; must belong to same tenant |
| `stream` | no | string | max 50 chars; unique per (tenant, grade_level_id) when both set |
| `teacherId` | no | string | Existing |
| `capacity` | no | int | 1–999, default 30 |
| `nextClassId` | no | string | Existing; must not create cycle |

**Response 400**:
- Stream already used within that grade level for this tenant.
- `gradeLevelId` does not belong to this tenant.

---

## Changed: `PUT /api/classes/(:id)`

Same new optional fields as `POST`. Same validation rules apply.

---

## Changed: `POST /api/classes/(:id)/assign-students`

**Extended request body** (new `force` field):
```json
{
  "studentIds": ["s1", "s2", "s3"],
  "force": false
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `studentIds` | yes | Array of student IDs to assign |
| `force` | no | `true` = admin override of capacity limit; default `false` |

**Capacity enforcement logic**:
1. Count current active enrollment in the class.
2. Count how many of the provided `studentIds` are NOT already in this class.
3. If `(current + new) > capacity` and `force === false` → return 409 with capacity info.
4. If `force === true` (admin only) → proceed regardless of capacity.

**Response 409** (capacity exceeded, no force):
```json
{
  "status": false,
  "message": "Class capacity exceeded",
  "errors": {
    "capacity": 35,
    "currentEnrolled": 33,
    "attemptingToAdd": 5,
    "available": 2
  }
}
```

**Response 403**: Non-admin user attempts `force: true`.

---

## Unchanged endpoints (still valid)

- `GET /api/classes/(:id)` — returns extended object (new fields added)
- `DELETE /api/classes/(:id)` — archive (unchanged behaviour)
- `POST /api/classes/(:id)/unarchive` — unchanged
- `DELETE /api/classes/(:id)/permanent-delete` — unchanged
- `PUT /api/classes/(:id)/next-class` — extended with cycle detection (returns 400 on cycle)
- `GET /api/classes/(:id)/next-class` — unchanged
- `GET /api/classes/(:id)/students` — unchanged
- `GET /api/classes/(:id)/student-count` — unchanged
- `GET /api/classes/(:id)/enrollment-history` — unchanged
- `GET /api/classes/student-counts` — unchanged
- `GET /api/classes/final` — unchanged (returns classes with no next_class_id)
- `GET /api/classes/promotion-preview` — unchanged behaviour; response items now include `gradeLevel` field
