# API Contract: GET /api/students-optimized

**Endpoint**: `GET /api/students-optimized`  
**Auth**: Bearer JWT required (JWTAuthFilter)  
**Tenant scope**: All data scoped to `tenant_id` from JWT payload

## Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `classId` | string | — | Filter table rows by class ID |
| `status` | string | `active` | Filter table rows by status (`active`, `inactive`, `graduated`, `transferred`, `dropped_out`, `all`) |
| `search` | string | — | Search name, guardian name, admission number |
| `balanceOnly` | boolean | `false` | Show only students with balance > 0 in table |
| `sortBy` | string | `name` | Sort table by `name`, `class`, or `balance` |
| `sortOrder` | string | `asc` | `asc` or `desc` |
| `page` | integer | `1` | Page number for table rows |
| `limit` | integer | `50` | Rows per page |
| `includeClasses` | boolean | `true` | Include class list in response |

**Important**: `classId`, `status`, `search`, `balanceOnly` filters apply **only** to the `students` array (table rows). The `stats` object always reflects the **full tenant population** regardless of active filters.

## Response Shape

```json
{
  "status": "success",
  "data": {
    "students": [
      {
        "id": "string",
        "tenantId": "string",
        "firstName": "string",
        "lastName": "string",
        "admissionNumber": "string",
        "gender": "string | null",
        "nationalId": "string",
        "className": "string",
        "classId": "string",
        "balance": 200.00,
        "dateOfBirth": "YYYY-MM-DD",
        "email": "string",
        "address": "string",
        "photoUrl": "string | null",
        "guardian": {
          "name": "string",
          "phone": "string",
          "email": "string",
          "relationship": "string"
        },
        "guardian2": null,
        "enrollmentDate": "YYYY-MM-DD",
        "status": "active | inactive | graduated | transferred | dropped_out",
        "bursaryStatus": "none | partial | full",
        "bursaryPercentage": 0,
        "bursaryReason": "string",
        "transport": {
          "hasTransport": false,
          "currentRouteId": null,
          "status": "none",
          "expiryDate": null,
          "notes": ""
        },
        "currentEnrollment": null
      }
    ],
    "stats": {
      "totalStudents": 200,
      "studentsWithOutstandingBalance": 60,
      "totalFeesOwed": 15000.00,
      "bursaryCoveragePercentage": 15.0,
      "studentsOnFinancialAid": 30,
      "statusCounts": {
        "active": 185,
        "inactive": 6,
        "graduated": 4,
        "transferred": 3,
        "dropped_out": 2
      }
    },
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 200,
      "totalPages": 4
    },
    "classes": []
  }
}
```

## Balance Field Semantics

The `balance` field on each student in the `students` array represents:

```
balance = total_active_charges + total_approved_debits
        - total_payments - total_approved_credits
```

- Positive value → student owes fees
- Zero or negative value → student is paid up or has a credit

Voided and soft-deleted charges are excluded. Only `approved` ledger adjustments are included.

## Stats Field Semantics

| Field | Source | Reflects filters? |
|-------|--------|-------------------|
| `totalStudents` | COUNT(*) all students for tenant | No — always full population |
| `studentsWithOutstandingBalance` | COUNT where corrected balance > 0 | No — always full population |
| `totalFeesOwed` | SUM of positive corrected balances | No — always full population |
| `bursaryCoveragePercentage` | studentsOnFinancialAid / active × 100 | No — always full population |
| `studentsOnFinancialAid` | COUNT where bursary_status != 'none' | No — always full population |
| `statusCounts.*` | COUNT per status value | No — always full population |

## Changed Fields (vs prior behaviour)

| Field | Before | After |
|-------|--------|-------|
| All `stats` fields | Computed from current page only | Computed from full tenant population |
| `stats.studentsOnFinancialAid` | Did not exist | Added: integer count |
| `students[].balance` | Charges − Payments only | Charges + Approved Debits − Payments − Approved Credits |
