# API Contracts: Platform Admin Schools Page Redo

**Branch**: `042-admin-schools-page` | **Date**: 2026-04-26  
**Base URL**: `{VITE_PLATFORM_API_URL}` (default: `http://localhost:8080/api/platform`)  
**Auth**: All endpoints require `Authorization: Bearer <platform-admin-JWT>` with `scope: "platform"`.

---

## Unchanged endpoints (behaviour verified, no contract change)

### GET /tenants
Returns paginated tenant list. Fields unchanged — `subdomain` still returned but no longer rendered in the UI.

### POST /tenants/:id/suspend
No change. Returns `{ status: "success", message: "Tenant suspended." }` on success.

### POST /tenants/:id/reactivate
No change. Returns `{ status: "success", message: "Tenant reactivated." }` on success.

### GET /finance/invoices/:id/pdf
No change. Returns `application/pdf` blob. Used by the new Billing tab download button.

---

## Modified endpoint

### DELETE /tenants/:id

**Change**: Extended financial-records safeguard check. Now blocks on `subscription_invoices` and `billing_events` in addition to `payments` and `charges`.

**Success (200)**:
```json
{ "status": "success", "data": null, "message": "Tenant deleted." }
```

**Blocked — financial records exist (409)**:
```json
{ "status": "error", "message": "Cannot delete tenant with existing financial records. Consider suspending this tenant instead.", "errors": {} }
```

**Forbidden — insufficient role (403)**:
```json
{ "status": "error", "message": "Only Owner role can delete tenants.", "errors": {} }
```

**Not found (404)**:
```json
{ "status": "error", "message": "Tenant not found.", "errors": {} }
```

**Authorization**: `canDeleteTenants` — Owner role only (unchanged).

---

## New endpoint

### GET /tenants/:id/invoices

**Purpose**: Return the full paginated invoice history for a single tenant, with payment status. Used by the `TenantBillingTab` component.

**Route**: `GET /api/platform/tenants/{id}/invoices`  
**Controller**: `TenantsController::tenantInvoices($id)`  
**Authorization**: `canManageTenants` — Owner or Admin role.

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `status` | string | No | Filter by payment status: `paid`, `pending`, `failed`, `refunded` |
| `sort` | string | No | Sort field: `issued_at` (default), `amount` |
| `dir` | string | No | Sort direction: `desc` (default), `asc` |

**Success response (200)**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "inv-uuid",
      "invoice_number": "INV-2026-001",
      "amount": 49.00,
      "currency": "USD",
      "issued_at": "2026-03-01T00:00:00Z",
      "payment_status": "paid"
    }
  ],
  "message": "OK",
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "last_page": 1
  }
}
```

**Empty (200 — no invoices)**:
```json
{
  "status": "success",
  "data": [],
  "message": "OK",
  "meta": { "total": 0, "page": 1, "limit": 20, "last_page": 1 }
}
```

**Not found (404)** — if tenant ID does not exist:
```json
{ "status": "error", "message": "Tenant not found.", "errors": {} }
```

---

## Frontend API function additions (`platform.ts`)

```typescript
// New: per-tenant invoice list
export const getTenantInvoices = (
  tenantId: string,
  params: Record<string, unknown> = {}
) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get(`/tenants/${tenantId}/invoices${qs ? '?' + qs : ''}`);
};

// Existing — already in platform.ts, used by TenantBillingTab:
// downloadInvoicePdf(id: string) → GET /finance/invoices/:id/pdf → Blob
```

---

## Audit log events emitted (backend, unchanged shape)

| Event | Trigger | Actor | Target |
|-------|---------|-------|--------|
| `platform.tenant.suspend` | Suspend action success | Platform admin | `tenant:{id}` |
| `platform.tenant.reactivate` | Reactivate action success | Platform admin | `tenant:{id}` |
| `platform.tenant.delete` | Delete action success | Platform admin | `tenant:{id}` |

**Note**: Refused deletes (409 responses) are currently not emitted as audit events. The spec (FR-036) requires refused deletes to also be logged. This is an additional task for the backend — add an `AuditService::logFromRequest('platform.tenant.delete_refused', ...)` call before returning the 409 error.
