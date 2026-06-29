# API Contract: Staff Endpoints (changes only)

**Branch**: `010-kiosk-employee-id` | **Date**: 2026-04-06  
**Auth**: Bearer JWT (JWTAuthFilter)

Only the changed/extended parts of the Staff API are documented here. Unchanged endpoints are not listed.

---

## GET /api/staff (index) — changed

The staff list response now includes `employeeId` in each record.

### Response: 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "st001",
      "tenantId": "tenant-uuid",
      "firstName": "Sarah",
      "lastName": "Moyo",
      "name": "Sarah Moyo",
      "email": "sarah.moyo@school.co.zw",
      "phone": "+263 77 123 4567",
      "employeeId": "EMP0001",
      "position": "Mathematics Teacher",
      "department": "Science",
      "isTeaching": true,
      "hireDate": "2023-01-15",
      "employmentStatus": "active",
      "status": "active"
    }
  ]
}
```

**Change**: Added `employeeId` field to each staff object.

---

## GET /api/staff/:id (show) — changed

### Response: 200 OK

Same shape as the index response but for a single staff record. The `employeeId` field is included.

---

## POST /api/staff (create) — changed

Employee ID is **not accepted** in the request body. It is auto-generated server-side.

### Request Body

```json
{
  "firstName": "John",
  "lastName": "Banda",
  "email": "john.banda@school.co.zw",
  "phone": "+263 77 987 6543",
  "position": "Bursar",
  "department": "Finance",
  "isTeaching": false,
  "hireDate": "2026-04-06",
  "employmentStatus": "active"
}
```

> If `employeeId` is included in the request body, it is **silently ignored**. The server always generates the ID.

### Response: 201 Created

```json
{
  "success": true,
  "data": {
    "id": "st042",
    "employeeId": "EMP0042",
    "firstName": "John",
    ...
  }
}
```

**Change**: `employeeId` is now always present in the created record response.

---

## PUT /api/staff/:id (update) — unchanged in contract

`employeeId` is NOT included in the update response as a writable field. If accidentally submitted, it is ignored (not in `formatFromApi()`). The response includes the current `employeeId` value.

---

## Settings Endpoint Changes

### GET /api/settings — changed

```json
{
  "success": true,
  "data": {
    "schoolName": "Greenwood Academy",
    "kioskModeEnabled": true,
    "kioskCode": "xK3mP9vR2q",
    "staffWorkHours": { "startTime": "08:30", "endTime": "17:00" },
    ...
  }
}
```

**Change**: Added `kioskCode` field to the settings response. Frontend uses this to construct the kiosk URL: `${origin}/kiosk/${kioskCode}`.

### PUT /api/settings — changed

The `kiosk_code` is auto-generated server-side if not present. It is not accepted from the request body (silently ignored if submitted).
