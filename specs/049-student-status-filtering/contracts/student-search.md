# API Contract: Student Search Endpoint

**Endpoint**: `GET /api/students/search`  
**Auth**: Bearer JWT (JWTAuthFilter)  
**Tenant scope**: Derived from JWT `tenant_id`

---

## Change Summary

Add optional `limit` query parameter. Behaviour is otherwise unchanged.

---

## Request

### Query Parameters

| Parameter | Type | Required | Default | Max | Description |
|-----------|------|----------|---------|-----|-------------|
| `query` | string | No | `""` | — | Search term matched against name, admission number |
| `classId` | string | No | `""` | — | Filter results to a specific class |
| `limit` | integer | No | `20` | `50` | Maximum number of results to return |

The `limit` value is clamped server-side: values below 1 are treated as 1; values above 50 are treated as 50.

### Example

```
GET /api/students/search?query=john&limit=20
Authorization: Bearer <token>
```

---

## Response

### Success (200)

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "admissionNumber": "ADM-001",
      "className": "Grade 3A",
      "status": "active",
      "balance": 150.00
    }
  ],
  "message": "Students retrieved successfully"
}
```

**Notes**:
- Results include students of **all statuses** — no status filter is applied.
- Results are ordered by `last_name`, `first_name` ascending.
- `balance` is the current outstanding balance (computed from charges - payments).
- Array length ≤ `limit` parameter value.

### Error (400)

```json
{
  "status": "error",
  "message": "Invalid limit parameter",
  "errors": {}
}
```

---

## Behavioural Contract for Payment Modal (Frontend)

The payment modal MUST use this endpoint with the following constraints:

1. **No pre-load**: Do not call this endpoint when the modal opens. Call only after the user types.
2. **Debounce**: Trigger a call no sooner than 300ms after the last keystroke.
3. **Cancellation**: Abort the previous in-flight request before sending a new one.
4. **No status filter**: Do not append a `status` parameter — all statuses must be returned.
5. **Limit**: Use `limit=20` for the modal search results.
6. **Empty state**: When no search term is present, show an empty list with a prompt ("Type to search students").
7. **Error state**: On search failure, show an inline error message; do not leave the list in a stale state.
