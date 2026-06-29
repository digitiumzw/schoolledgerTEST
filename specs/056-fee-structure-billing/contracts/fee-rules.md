# API Contract: Fee Rule Management

**Branch**: `056-fee-structure-billing` | **Date**: 2026-05-01  
**Controller**: `App\Controllers\Api\FeeRuleController`  
**Base path**: `/api/fee-rules`  
**Auth**: JWT required on all endpoints. Role enforcement per endpoint.

---

## GET /api/fee-rules

List all active fee rules for the authenticated tenant.

**Roles**: `admin`, `bursar`

### Response 200

```json
{
  "status": "success",
  "data": [
    {
      "id": "fr-abc123",
      "name": "Tuition",
      "amount": 150.00,
      "assignmentScopeType": "school_wide",
      "assignmentScopeId": null,
      "assignmentScopeLabel": "All Students",
      "isActive": true,
      "createdAt": "2026-05-01T09:00:00Z"
    },
    {
      "id": "fr-def456",
      "name": "Library Fee",
      "amount": 20.00,
      "assignmentScopeType": "class",
      "assignmentScopeId": "cls-grade1",
      "assignmentScopeLabel": "Grade 1",
      "isActive": true,
      "createdAt": "2026-05-01T09:05:00Z"
    }
  ]
}
```

---

## POST /api/fee-rules

Create a new fee rule.

**Roles**: `admin` only

### Request Body

```json
{
  "name": "Sports Fee",
  "amount": 25.00,
  "assignmentScopeType": "category",
  "assignmentScopeId": "boarder"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | ✅ | Must be unique within the tenant |
| `amount` | number | ✅ | Must be > 0 |
| `assignmentScopeType` | string (enum) | ✅ | One of: `school_wide`, `class`, `category`, `service` |
| `assignmentScopeId` | string | Conditional | Required when scope ≠ `school_wide`; must be NULL/omitted when scope = `school_wide` |

### Response 201

```json
{
  "status": "success",
  "data": {
    "id": "fr-ghi789",
    "name": "Sports Fee",
    "amount": 25.00,
    "assignmentScopeType": "category",
    "assignmentScopeId": "boarder",
    "assignmentScopeLabel": "Category: boarder",
    "isActive": true,
    "createdAt": "2026-05-01T10:00:00Z"
  }
}
```

### Error Responses

| Status | Reason |
|--------|--------|
| 400 | Missing required field (`name`, `amount`, `assignmentScopeType`) |
| 400 | `amount` ≤ 0 |
| 400 | `assignmentScopeId` missing for non-school-wide scope |
| 409 | A fee rule with this name already exists for the tenant |
| 403 | Caller does not have `admin` role |

---

## PUT /api/fee-rules/:id

Update an existing fee rule.

**Roles**: `admin` only

### Request Body

```json
{
  "name": "Sports Fee",
  "amount": 30.00,
  "assignmentScopeType": "category",
  "assignmentScopeId": "boarder"
}
```

Same field rules as POST. All fields are optional; only provided fields are updated.

### Response 200

```json
{
  "status": "success",
  "data": {
    "id": "fr-ghi789",
    "name": "Sports Fee",
    "amount": 30.00,
    "assignmentScopeType": "category",
    "assignmentScopeId": "boarder",
    "assignmentScopeLabel": "Category: boarder",
    "isActive": true,
    "updatedAt": "2026-05-01T11:00:00Z"
  }
}
```

### Error Responses

| Status | Reason |
|--------|--------|
| 404 | Fee rule not found or belongs to a different tenant |
| 400 | Validation failure (same rules as POST) |
| 409 | Name conflict with another existing rule |
| 403 | Caller does not have `admin` role |

---

## DELETE /api/fee-rules/:id

Delete a fee rule. Charges already generated from this rule are unaffected.

**Roles**: `admin` only

### Response 200

```json
{
  "status": "success",
  "data": {
    "id": "fr-ghi789",
    "deleted": true
  }
}
```

### Error Responses

| Status | Reason |
|--------|--------|
| 404 | Fee rule not found or belongs to a different tenant |
| 403 | Caller does not have `admin` role |
