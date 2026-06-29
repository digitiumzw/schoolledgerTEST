# API Contracts: Recent Activity Feed

## Platform Dashboard Activity

`GET /api/platform/dashboard/activity`

Returns platform-level audit events. Only events starting with `platform.` are returned.

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "id": 123,
      "action": "platform.tenant.provision",
      "target_type": "tenant",
      "target_id": "T001",
      "target_name": "Greenwood High",
      "actor_user_id": 4,
      "actor_name": "Platform Admin",
      "actor_email": "admin@platform.com",
      "ip_address": "192.168.1.1",
      "created_at": "2026-05-22 14:00:00",
      "created_at_human": "May 22, 2026 2:00 PM",
      "details": { ... }
    }
  ]
}
```

## Tenant Dashboard Activity

`GET /api/dashboard/activity?limit={limit}`

Returns a chronological feed of recent tenant events aggregated from multiple sources (payments, enrollments, status changes, leave requests). Strictly scoped to the user's `tenant_id`.

**Response**:
```json
{
  "status": "success",
  "data": {
    "activities": [
      {
        "id": "pay_456",
        "type": "payment",
        "description": "Payment received",
        "detail": "John Doe — Fees",
        "amount": 150.00,
        "timestamp": "2026-05-22 10:30:00"
      },
      {
        "id": "enr_789",
        "type": "enrollment",
        "description": "Student enrolled",
        "detail": "Jane Smith — Grade 10A",
        "amount": null,
        "timestamp": "2026-05-21 09:15:00"
      },
      {
        "id": "stat_102",
        "type": "status_change",
        "description": "Student status changed to active",
        "detail": "Sam Brown — Reason: reactivated",
        "amount": null,
        "timestamp": "2026-05-20 11:45:00"
      },
      {
        "id": "lv_304",
        "type": "leave",
        "description": "Leave request approved",
        "detail": "Alice Teacher — sick leave",
        "amount": null,
        "timestamp": "2026-05-19 14:20:00"
      }
    ]
  }
}
```

## Frontend Type Changes

The existing `ActivityItem` interface in `frontend/src/hooks/useDashboardStats.ts` should be expanded if necessary:

```typescript
export interface ActivityItem {
  id: string;
  type: "payment" | "leave" | "enrollment" | "status_change";
  description: string;
  detail: string;
  amount?: number | null;
  timestamp: string;
}
```
