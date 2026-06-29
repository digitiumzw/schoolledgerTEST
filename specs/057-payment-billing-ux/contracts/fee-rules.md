# API Contract: Fee Rules

**Feature**: `057-payment-billing-ux`  
**Scope**: Changes to `POST /api/fee-rules` and `PUT /api/fee-rules/:id` to support multi-class scope

---

## Schema change context

`fee_rules.assignment_scope_id` is widened from `VARCHAR(50)` to `TEXT`. For `class`-scoped rules, the value may now be either:
- A plain class ID string (single class, backward-compat): `"cls_abc123"`
- A JSON-encoded array of class IDs (multi-class): `'["cls_abc","cls_def"]'`

---

## GET /api/fee-rules — List Fee Rules

### Changes from current

1. `assignmentScopeId` in the response may now be a **string array** (multi-class) or a plain string (single).
2. `assignmentScopeLabel` for `class`-type rules now returns `"class:<scopeId>"` (machine-readable prefix) when scope is a single class ID, or `"class:<json-array>"` when multi-class. The **frontend resolves human-readable class names** from its local class list.

### Response shape (changed fields only)

```json
{
  "id": "frl_1234",
  "assignmentScopeType": "class",
  "assignmentScopeId": ["cls_abc123", "cls_def456"],
  "assignmentScopeLabel": "class:[\"cls_abc123\",\"cls_def456\"]",
  "isActive": true
}
```

For single-class rules (existing data, backward-compat):

```json
{
  "assignmentScopeType": "class",
  "assignmentScopeId": "cls_abc123",
  "assignmentScopeLabel": "class:cls_abc123"
}
```

---

## POST /api/fee-rules — Create Fee Rule

### Changes from current

- `assignmentScopeId` may now be a JSON array when `assignmentScopeType = "class"`.

### Request

```
POST /api/fee-rules
Authorization: Bearer <jwt>  (role: admin | super_admin)
Content-Type: application/json
```

```json
{
  "name":                 "Form 3 Term Fee",
  "amount":               150.00,
  "assignmentScopeType":  "class",
  "assignmentScopeId":    ["cls_abc123", "cls_def456"],
  "isActive":             true
}
```

| Field | Type | Notes |
|---|---|---|
| `assignmentScopeId` | `string \| string[]` | For `class` scope: single ID or array of IDs. For other scopes: single string. |

### Validation rules

- When `assignmentScopeType = "class"` and `assignmentScopeId` is an array: each element must be a non-empty string. Empty array is rejected (same as missing scope ID).
- When `assignmentScopeType != "class"`: `assignmentScopeId` must be a scalar string (not an array).
- Storage: if `assignmentScopeId` is a PHP array, `json_encode` it before persisting.

### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "id":                   "frl_1746300789_abc",
    "name":                 "Form 3 Term Fee",
    "amount":               150.00,
    "assignmentScopeType":  "class",
    "assignmentScopeId":    ["cls_abc123", "cls_def456"],
    "assignmentScopeLabel": "class:[\"cls_abc123\",\"cls_def456\"]",
    "isActive":             true,
    "createdAt":            "2026-05-04T14:30:22Z",
    "updatedAt":            "2026-05-04T14:30:22Z"
  }
}
```

### Error responses

| Status | Condition |
|---|---|
| 400 | Missing required fields |
| 409 | Rule name already exists for tenant |
| 422 | Invalid scope type, invalid scope ID, empty class array |
| 403 | Insufficient role |

---

## PUT /api/fee-rules/:id — Update Fee Rule

### Changes from current

- Same `assignmentScopeId` array support as POST.
- Partial update: sending `assignmentScopeId` as an array when `assignmentScopeType` is already `"class"` replaces the list.

### Request

```
PUT /api/fee-rules/:id
Authorization: Bearer <jwt>  (role: admin | super_admin)
Content-Type: application/json
```

```json
{
  "assignmentScopeId": ["cls_abc123", "cls_def456", "cls_ghi789"]
}
```

### Response `200 OK`

Same shape as POST `201`.

---

## GET /api/fee-rules/unbilled-alert — Unbilled Alert (unchanged endpoint)

This endpoint is unchanged. The frontend Payments page will now also call it to show the ungenerated charges banner.

```json
{
  "success": true,
  "data": {
    "billingPeriod":       "2026-05",
    "eligibleStudentCount": 42,
    "unbilledStudentCount": 15
  }
}
```

Returns `{ "unbilledStudentCount": 0 }` (effectively) when all eligible students are billed.
