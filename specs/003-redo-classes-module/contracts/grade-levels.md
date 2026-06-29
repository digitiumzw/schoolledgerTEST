# API Contract: Grade Levels

**Resource**: `/api/grade-levels`
**Auth**: JWT Bearer required on all endpoints (JWTAuthFilter)
**Roles**: admin/super_admin for write operations; all authenticated roles for reads

---

## `GET /api/grade-levels`

Returns all grade levels for the authenticated tenant, ordered by `sort_order`.

**Query params**: none

**Response 200**:
```json
{
  "status": true,
  "message": "Success",
  "data": [
    {
      "id": "gl1234_abc",
      "tenantId": "t1",
      "name": "Grade 6",
      "sortOrder": 6,
      "classCount": 3,
      "createdAt": "2026-04-03T10:00:00Z"
    },
    {
      "id": "gl1234_xyz",
      "tenantId": "t1",
      "name": "Grade 7",
      "sortOrder": 7,
      "classCount": 2,
      "createdAt": "2026-04-03T10:00:00Z"
    }
  ]
}
```

---

## `GET /api/grade-levels/(:id)`

Returns a single grade level with its classes.

**Response 200**:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "id": "gl1234_xyz",
    "tenantId": "t1",
    "name": "Grade 7",
    "sortOrder": 7,
    "classCount": 2,
    "classes": [
      { "id": "c1", "name": "7A", "stream": "A", "studentCount": 28, "capacity": 35 },
      { "id": "c2", "name": "7B", "stream": "B", "studentCount": 30, "capacity": 35 }
    ]
  }
}
```

**Response 404**: Grade level not found or belongs to different tenant.

---

## `POST /api/grade-levels`

Create a new grade level.

**Roles**: admin, super_admin only

**Request body**:
```json
{
  "name": "Grade 7",
  "sortOrder": 7
}
```

| Field | Required | Type | Rules |
|-------|----------|------|-------|
| `name` | yes | string | max 100 chars, unique per tenant |
| `sortOrder` | no | int | ≥ 0; defaults to current max + 1 |

**Response 201**: Returns created grade level object.

**Response 400**: `name` missing, blank, or duplicate within tenant.

---

## `PUT /api/grade-levels/(:id)`

Update a grade level's name or sort order.

**Roles**: admin, super_admin only

**Request body** (all fields optional; omitted fields unchanged):
```json
{
  "name": "Grade 7 (Secondary)",
  "sortOrder": 8
}
```

**Response 200**: Returns updated grade level object.

**Response 404**: Not found or wrong tenant.

---

## `DELETE /api/grade-levels/(:id)`

Delete a grade level. Classes assigned to it have their `grade_level_id` set to NULL (they become ungrouped); no classes are deleted.

**Roles**: admin, super_admin only

**Response 200**:
```json
{
  "status": true,
  "message": "Grade level deleted. 3 class(es) are now ungrouped.",
  "data": { "id": "gl1234_xyz", "affectedClasses": 3 }
}
```

**Response 404**: Not found or wrong tenant.

---

## `PUT /api/grade-levels/reorder`

Bulk update sort order for multiple grade levels in one call.

**Roles**: admin, super_admin only

**Request body**:
```json
{
  "order": [
    { "id": "gl1", "sortOrder": 1 },
    { "id": "gl2", "sortOrder": 2 },
    { "id": "gl3", "sortOrder": 3 }
  ]
}
```

**Response 200**: `{ "status": true, "message": "Grade levels reordered" }`

**Response 400**: Any ID in the list does not belong to the tenant.
