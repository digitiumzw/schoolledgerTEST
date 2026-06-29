# API Contract Changes: Fix Class Promotion Logic

**Branch**: `005-fix-class-promotion` | **Date**: 2026-04-06

All changes are **backward-compatible additions** to existing endpoints. No endpoints are removed or renamed. No new routes are added.

---

## PUT /api/classes/{id}/next-class

### Request Body (updated)

```json
{
  "nextClassId": "class_002",   // string|null — set to null to clear the chain
  "isFinalClass": false         // boolean — NEW optional field; true = graduation class
}
```

**Business rules**:
- If `nextClassId` is provided (non-null), `is_final_class` is set to `false` regardless of `isFinalClass` in the request.
- If `nextClassId` is `null` and `isFinalClass` is `true`, the class is marked as a final/graduation class.
- If `nextClassId` is `null` and `isFinalClass` is `false` (or omitted), the class is marked as unconfigured.

### Response (updated)

```json
{
  "success": true,
  "message": "Next class updated successfully",
  "data": {
    "id": "class_001",
    "tenantId": "tenant_001",
    "name": "7A",
    "nextClassId": "class_002",
    "isFinalClass": false,       // NEW field in response
    ...
  }
}
```

---

## GET /api/classes (list) and GET /api/classes/{id}

### Response (updated)

Each class object in the response now includes `isFinalClass`:

```json
{
  "id": "class_005",
  "tenantId": "tenant_001",
  "name": "11A",
  "nextClassId": null,
  "isFinalClass": true,         // NEW field
  ...
}
```

---

## POST /api/students/promote (bulk promotion)

### No request changes

### Response `promotionDetails` entries (updated)

Each class entry in `promotionDetails` will now include a `reason` field for skipped classes:

```json
{
  "classId": "class_003",
  "className": "9A",
  "promoted": 0,
  "graduated": 0,
  "skipped": 12,
  "nextClass": null,
  "errors": ["No next class configured for 9A — set next_class_id or mark as final class"]
}
```

---

## POST /api/students/{id}/promote (single-student promotion)

### No request changes

### Behaviour change

- **Before**: Returns `400 "No next class available for promotion"` when auto-promoting a student in a final class.
- **After**: Graduates the student if `is_final_class = true`; returns the error only if the class is unconfigured (`is_final_class = false` AND `next_class_id = null`).

---

## GET /api/classes/promotion-preview

### No request changes

### Response (updated)

Each class preview entry now includes `isFinalClass` and a `status` field:

```json
{
  "classId": "class_005",
  "className": "11A",
  "isFinalClass": true,
  "status": "final",            // "promotable" | "final" | "unconfigured"
  "nextClass": null,
  "eligibleStudents": 8,
  "action": "graduate"          // "promote" | "graduate" | "skip"
}
```
