# API Contract: Route Balance and Printable Student List

**Feature**: 087-route-balance-printing  
**Date**: 2026-06-09

## Endpoint: GET /api/transport/routes/:id (enriched)

**Existing endpoint**: The response is enriched with balance data. All other behavior remains unchanged.

### Request

```
GET /api/transport/routes/{routeId}
Authorization: Bearer {jwt_token}
```

**Path Parameters**:
- `routeId` (string, required): The route ID.

**Query Parameters**: None.

**Roles**: `super_admin`, `admin`, `bursar` (existing).

### Response: 200 OK

```json
{
  "status": "success",
  "data": {
    "id": "route_abc123",
    "routeName": "Northwood Express",
    "monthlyFee": 45.00,
    "status": "active",
    "stops": [
      { "id": "stop_1", "name": "Main Gate", "pickupTime": "07:30" }
    ],
    "stopCount": 1,
    "vehicle": {
      "id": "veh_1",
      "name": "Bus 1",
      "regNumber": "ABC-123-GP",
      "type": "bus",
      "capacity": 45
    },
    "driver": {
      "id": "drv_1",
      "name": "John Moyo",
      "phone": "+263771234567"
    },
    "periodId": "rp_1",
    "students": [
      {
        "allocationId": "tsa_1",
        "studentId": "s_1",
        "studentName": "Tendai Mutasa",
        "studentClass": "Grade 5A",
        "stopId": "stop_1",
        "stopName": "Main Gate",
        "direction": "both",
        "status": "Active",
        "balance": 120.00
      }
    ],
    "balanceSummary": {
      "totalStudents": 1,
      "studentsWithBalance": 1,
      "totalOutstandingBalance": 120.00
    }
  },
  "message": "Route fetched successfully"
}
```

### Response Fields (additive)

| Field | Type | Description |
|-------|------|-------------|
| `data.students[].balance` | `number \| null` | Student's total outstanding balance. `null` if ledger computation fails. |
| `data.balanceSummary` | `object` | Route-level balance aggregates. |
| `data.balanceSummary.totalStudents` | `number` | Count of active students on the route. |
| `data.balanceSummary.studentsWithBalance` | `number` | Count of students with `balance > 0`. |
| `data.balanceSummary.totalOutstandingBalance` | `number` | Sum of all positive balances on the route. |

### Error Responses

All existing error responses are preserved:
- `401 Unauthorized`: Missing or invalid JWT.
- `403 Forbidden`: User role not allowed.
- `404 Not Found`: Route does not exist or belongs to a different tenant.

### Additional Error: Ledger Computation Failure

If the LedgerService query fails internally, the endpoint still returns `200 OK` with the route data, but all `balance` fields are `null` and `balanceSummary` shows zero values. This is a graceful degradation (per edge-case spec). No separate error code is returned.

## TypeScript Types

```typescript
// Enriched existing type
interface TransportAllocationStudent {
  allocationId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  stopId: string | null;
  stopName: string | null;
  direction: 'both' | 'inbound' | 'outbound';
  status: 'Active' | 'inactive';
  balance: number | null; // NEW
}

// New computed type
interface RouteBalanceSummary {
  totalStudents: number;
  studentsWithBalance: number;
  totalOutstandingBalance: number;
}

// Enriched existing type
interface TransportRoute {
  // ... existing fields ...
  students: TransportAllocationStudent[];
  balanceSummary?: RouteBalanceSummary; // NEW
}
```
