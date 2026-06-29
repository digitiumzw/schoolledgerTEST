# Data Model: Platform Admin Schools Page Redo

**Branch**: `042-admin-schools-page` | **Date**: 2026-04-26

No schema changes are required for this feature. All entities already exist in the database. This document describes the relevant entities, their fields, and which are used or affected by this feature.

---

## Entities

### Tenant

**Table**: `tenants`  
**Primary key**: `id` (UUID, VARCHAR 36)

| Field | Type | Used by this feature | Notes |
|-------|------|---------------------|-------|
| `id` | UUID | ✅ Read | Displayed in sheet header; used as key for all child queries |
| `name` | VARCHAR | ✅ Read | Displayed in list and sheet; used as confirmation value for delete dialog |
| `email` | VARCHAR | ✅ Read | Displayed in list and sheet Profile tab |
| `subdomain` | VARCHAR | ❌ Not displayed | Still fetched by `index()` / `show()` — kept in backend query and TS type but **not rendered** |
| `status` | VARCHAR | ✅ Read / Write | Displayed as `StatusBadge`; mutated by suspend / reactivate |
| `settings` | JSON | — | Not used in this feature |
| `created_at` | DATETIME | ✅ Read | Displayed as "Joined" date in list and Profile tab |

**Status transitions** (relevant to this feature):

```
active ──suspend──► suspended ──reactivate──► active
active / suspended ──delete (no financial records)──► [removed]
```

---

### Subscription Invoice

**Table**: `subscription_invoices`  
**Primary key**: `id` (UUID or auto-increment — confirmed in FinanceController usage)

| Field | Type | Used by this feature | Notes |
|-------|------|---------------------|-------|
| `id` | PK | ✅ Read | Used as key in invoice list and as argument to `invoicePdf($id)` |
| `tenant_id` | FK → tenants.id | ✅ Filter | Used to scope the new `tenantInvoices()` endpoint and in the extended delete safeguard check |
| `invoice_number` | VARCHAR | ✅ Read | Displayed as invoice identifier in Billing tab |
| `school_name` | VARCHAR (snapshot) | — | Not displayed in tenant detail (redundant — we already know the school) |
| `plan_name` | VARCHAR (snapshot) | — | Not displayed in tenant detail |
| `amount_cents` | INT | ✅ Read | Converted to dollars (`/ 100`) and displayed |
| `currency` | VARCHAR | ✅ Read | Displayed alongside amount |
| `issued_at` | DATETIME | ✅ Read | Displayed as invoice date; used for sorting |
| `transaction_id` | FK → subscription_payment_transactions.id | ✅ Join | Joined to derive `payment_status` |

---

### Subscription Payment Transaction

**Table**: `subscription_payment_transactions`  
**Primary key**: `id`

| Field | Type | Used by this feature | Notes |
|-------|------|---------------------|-------|
| `id` | PK | ✅ Join | Joined from `subscription_invoices.transaction_id` |
| `status` | VARCHAR | ✅ Read | Aliased as `payment_status`; rendered via `StatusBadge` in Billing tab. Values: `paid`, `pending`, `failed`, `refunded` |

---

### Payment

**Table**: `payments`  
**Primary key**: `id`

| Field | Type | Used by this feature | Notes |
|-------|------|---------------------|-------|
| `tenant_id` | FK → tenants.id | ✅ Safeguard check | Checked in `delete()` — if count > 0, delete is blocked |

---

### Charge

**Table**: `charges`  
**Primary key**: `id`

| Field | Type | Used by this feature | Notes |
|-------|------|---------------------|-------|
| `tenant_id` | FK → tenants.id | ✅ Safeguard check | Checked in `delete()` — if count > 0, delete is blocked |

---

### Billing Event

**Table**: `billing_events`  
**Primary key**: `id` (UUID)

| Field | Type | Used by this feature | Notes |
|-------|------|---------------------|-------|
| `tenant_id` | FK → tenants.id | ✅ Safeguard check (new) | **New check** added to `delete()` — if count > 0, delete is blocked |

---

## Validation Rules

### Delete safeguard (backend — `TenantsController::delete()`)

A delete request is refused (HTTP 409) if ANY of the following are true:
- `COUNT(*) FROM payments WHERE tenant_id = :id` > 0
- `COUNT(*) FROM charges WHERE tenant_id = :id` > 0
- `COUNT(*) FROM subscription_invoices WHERE tenant_id = :id` > 0  ← **new**
- `COUNT(*) FROM billing_events WHERE tenant_id = :id` > 0  ← **new**

### Delete name confirmation (frontend — delete Dialog)

- The confirm button is **disabled** unless `inputValue === tenant.name` (exact, case-sensitive string match).
- The dialog is dismissed (without sending a request) if the user navigates away or closes it without confirming.

### Suspend / Reactivate (backend — existing, no change)

- Suspend: any tenant may be suspended regardless of financial records.
- Reactivate: any suspended tenant may be reactivated.
- Both require `canManageTenants` role (Owner or Admin).

---

## Frontend Type Contract

The existing `Tenant` TypeScript type in `Schools.tsx` requires one addition to support the Billing tab:

```typescript
type Tenant = {
  id: string;
  name: string;
  email: string;
  subdomain: string;          // kept in type; not rendered
  status: string;
  subscription_id: string | null;
  subscription_status: string | null;
  plan_name: string | null;
  monthly_price: number | null;
  billing_cycle: string | null;
  expires_at: string | null;
  student_count: number;
  staff_count: number;
  created_at: string;
  // recent_invoices removed — billing tab fetches independently
};

type TenantInvoice = {
  id: string;
  invoice_number: string;
  amount: number;             // amount_cents / 100
  currency: string;
  issued_at: string;
  payment_status: string;     // from joined subscription_payment_transactions
};
```
