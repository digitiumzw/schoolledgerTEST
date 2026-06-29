# API Contract: Driver Kiosk

**Feature**: 055-driver-kiosk-viewonly  
**Base Path**: `/api/kiosk/driver`  
**Authentication**: Kiosk Code + Employee ID (No JWT)

## Overview

Public kiosk endpoints for driver access to bus, route, and student information. These endpoints are intentionally exempt from JWTAuthFilter as they are accessed from shared terminals without authenticated user sessions.

Security Model:
- `kiosk_code`: Opaque 10-character token from `tenants.settings` (resolves tenant)
- `employee_id`: Driver's unique Employee ID (e.g., EMP0001)
- Unified 403 responses prevent staff enumeration
- Route ownership verified via `driver_staff_id` on routes

---

## Endpoints

### POST `/api/kiosk/driver/validate`

Validate driver Employee ID and return complete assignment information including bus and routes.

**Request Body:**
```json
{
  "kiosk_code": "string (required)",
  "employee_id": "string (required)"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Driver validated successfully",
  "data": {
    "driverName": "John Smith",
    "employeeId": "EMP0001",
    "bus": {
      "id": "veh_123",
      "name": "Bus A",
      "regNumber": "ABC-123-GP",
      "type": "bus",
      "capacity": 60
    },
    "routes": [
      {
        "id": "route_456",
        "name": "North Route",
        "description": "Northern suburbs pickup",
        "stops": [
          {
            "id": "stop_001",
            "name": "Main Gate",
            "pickupTime": "07:30",
            "orderPosition": 0
          },
          {
            "id": "stop_002",
            "name": "Shopping Center",
            "pickupTime": "07:45",
            "orderPosition": 1
          }
        ]
      }
    ]
  }
}
```

**Error Responses:**

- **400 Bad Request**: Missing required fields
  ```json
  {
    "status": false,
    "message": "kiosk_code is required"
  }
  ```

- **403 Forbidden**: Invalid kiosk code, unrecognized employee, or inactive staff
  ```json
  {
    "status": false,
    "message": "Employee ID not recognized"
  }
  ```

- **404 Not Found**: Kiosk not found
  ```json
  {
    "status": false,
    "message": "Kiosk not found"
  }
  ```

---

### GET `/api/kiosk/driver/routes/:kiosk_code`

Get detailed student roster for a specific route with optional payment filter.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employee_id` | string | Yes | Driver's Employee ID |
| `route_id` | string | Yes | Route ID to query |
| `paid_only` | boolean | No | Filter to paid students only (default: false) |

**Example URL:**
```
/api/kiosk/driver/routes/KIOSHCODE123?employee_id=EMP0001&route_id=route_456&paid_only=true
```

**Success Response (200):**
```json
{
  "status": true,
  "message": "Roster retrieved successfully",
  "data": {
    "routeName": "North Route",
    "busName": "Bus A",
    "students": [
      {
        "id": "stu_001",
        "firstName": "Alice",
        "lastName": "Johnson",
        "stop": {
          "id": "stop_001",
          "name": "Main Gate",
          "pickupTime": "07:30"
        },
        "direction": "both",
        "notes": "Wheelchair accessible",
        "paymentStatus": "paid"
      },
      {
        "id": "stu_002",
        "firstName": "Bob",
        "lastName": "Williams",
        "stop": {
          "id": "stop_002",
          "name": "Shopping Center",
          "pickupTime": "07:45"
        },
        "direction": "inbound",
        "notes": null,
        "paymentStatus": "unpaid"
      }
    ],
    "totalCount": 25,
    "paidCount": 23,
    "unpaidCount": 2
  }
}
```

**Student Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Student unique ID |
| `firstName` | string | Student first name |
| `lastName` | string | Student last name |
| `stop` | object | Assigned stop information |
| `stop.id` | string | Stop ID |
| `stop.name` | string | Stop display name |
| `stop.pickupTime` | string\|null | Estimated pickup time |
| `direction` | string | 'both', 'inbound', or 'outbound' |
| `notes` | string\|null | Special instructions from allocation |
| `paymentStatus` | string | 'paid' or 'unpaid' (only when paid_only=false, else always 'paid') |

**Error Responses:**

- **400 Bad Request**: Missing required parameters
  ```json
  {
    "status": false,
    "message": "employee_id and route_id are required"
  }
  ```

- **403 Forbidden**: Invalid credentials or route not assigned to driver
  ```json
  {
    "status": false,
    "message": "Access denied"
  }
  ```

- **404 Not Found**: Kiosk not found
  ```json
  {
    "status": false,
    "message": "Kiosk not found"
  }
  ```

---

## TypeScript Interfaces

```typescript
// Bus/Vehicle Information
interface KioskBus {
  id: string;
  name: string;
  regNumber: string | null;
  type: 'bus' | 'minibus' | 'van' | 'other';
  capacity: number;
}

// Stop Information
interface KioskStop {
  id: string;
  name: string;
  pickupTime: string | null;
  orderPosition: number;
}

// Route with Stops
interface KioskRoute {
  id: string;
  name: string;
  description: string | null;
  stops: KioskStop[];
}

// Student Stop Assignment
interface StudentStop {
  id: string;
  name: string;
  pickupTime: string | null;
}

// Student in Roster
interface KioskStudent {
  id: string;
  firstName: string;
  lastName: string;
  stop: StudentStop;
  direction: 'both' | 'inbound' | 'outbound';
  notes: string | null;
  paymentStatus: 'paid' | 'unpaid';
}

// Validate Response
interface DriverKioskValidateResponse {
  driverName: string;
  employeeId: string;
  bus: KioskBus;
  routes: KioskRoute[];
}

// Roster Response
interface DriverKioskRosterResponse {
  routeName: string;
  busName: string;
  students: KioskStudent[];
  totalCount: number;
  paidCount: number;
  unpaidCount: number;
}
```

---

## Security Considerations

1. **Enumeration Prevention**: All authentication failures return 403 with the same message "Employee ID not recognized" - never distinguish between invalid kiosk code, invalid employee, or inactive staff.

2. **Route Ownership Verification**: Every roster request verifies the route is assigned to the requesting driver via `transport_routes.driver_staff_id`.

3. **Tenant Isolation**: All queries filter by `tenant_id` resolved from kiosk_code.

4. **View-Only Enforcement**: No POST/PUT/DELETE endpoints exposed for driver kiosk - strictly read-only access.

5. **Session Timeout**: Frontend implements 2-minute idle timeout with automatic logout.

---

## Implementation Notes

- Use existing `BaseApiController::success()` and `::error()` helpers for consistent response format
- Reuse existing `DriverKioskController::resolveTenant()` helper for kiosk code resolution
- Payment status calculation uses existing ledger pattern: `SUM(payments) >= SUM(transport_charges)`
- All queries must include `tenant_id` per Constitution Principle I
