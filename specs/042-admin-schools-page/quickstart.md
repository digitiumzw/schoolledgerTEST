# Quickstart: Platform Admin Schools Page Redo

**Branch**: `042-admin-schools-page` | **Date**: 2026-04-26

This guide describes the minimum steps to get the feature running locally and how to verify each of the five gaps is resolved.

---

## Prerequisites

- Backend running at `http://localhost:8080` (CodeIgniter 4, `php spark serve --port 8080`)
- Frontend (`admin-frontend`) running with `bun run dev` or `npm run dev`
- A platform-admin account exists in `platform_users` (Owner or Admin role for full testing)
- At least two tenant records exist — one with financial records (invoices/payments), one clean

---

## Backend changes to apply

### 1. Extend delete safeguard (`TenantsController.php`)

In `backend/app/Controllers/Platform/TenantsController.php`, extend the `delete()` method financial check:

```php
// Replace the current two-table check with all four:
$hasPayments  = $db->table('payments')->where('tenant_id', $id)->countAllResults() > 0;
$hasCharges   = $db->table('charges')->where('tenant_id', $id)->countAllResults() > 0;
$hasInvoices  = $db->table('subscription_invoices')->where('tenant_id', $id)->countAllResults() > 0;
$hasEvents    = $db->table('billing_events')->where('tenant_id', $id)->countAllResults() > 0;

if ($hasPayments || $hasCharges || $hasInvoices || $hasEvents) {
    AuditService::logFromRequest('platform.tenant.delete_refused', 'tenant', $id, ['name' => $tenant['name']]);
    return $this->error('Cannot delete tenant with existing financial records. Consider suspending this tenant instead.', 409);
}
```

### 2. Add `tenantInvoices` method (`TenantsController.php`)

```php
public function tenantInvoices($id = null)
{
    if (!$this->canManageTenants($this->getPlatformRole())) {
        return $this->forbidden();
    }

    $tenant = $this->tenantModel->find($id);
    if (!$tenant) {
        return $this->notFound('Tenant not found.');
    }

    [$page, $limit, $offset] = $this->getPaginationParams(20, 100);
    $db = \Config\Database::connect();

    $builder = $db->table('subscription_invoices si')
        ->select('si.id, si.invoice_number, (si.amount_cents / 100) AS amount,
                  si.currency, si.issued_at, spt.status AS payment_status', false)
        ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left')
        ->where('si.tenant_id', $id);

    $status = $this->request->getGet('status');
    $dir    = strtoupper($this->request->getGet('dir') ?? 'DESC');
    $dir    = in_array($dir, ['ASC', 'DESC']) ? $dir : 'DESC';

    if ($status) {
        $builder->where('spt.status', $status);
    }

    $total    = $builder->countAllResults(false);
    $invoices = $builder->orderBy('si.issued_at', $dir)->limit($limit, $offset)->get()->getResultArray();

    return $this->success($invoices, 'OK', 200, $this->buildPaginationMeta($total, $page, $limit));
}
```

### 3. Register the new route (`Routes.php`)

In `backend/app/Config/Routes.php`, inside the `api/platform` group, add after the existing tenant routes:

```php
$routes->get('tenants/(:segment)/invoices', 'TenantsController::tenantInvoices/$1');
```

Place this **before** `$routes->get('tenants/(:segment)', ...)` to avoid route shadowing, or ensure it is registered in specificity order.

---

## Frontend changes to apply

### 4. Add `getTenantInvoices` to `platform.ts`

```typescript
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
```

### 5. Create `TenantBillingTab.tsx`

New file at `frontend/src/admin/components/admin/TenantBillingTab.tsx`. This component:
- Accepts `tenantId: string` as a prop
- Uses `useQuery` to fetch from `getTenantInvoices(tenantId, { status, dir })`
- Renders a table with: invoice number, amount, currency, date, `StatusBadge` for payment status, and a download icon button
- The download button calls `downloadInvoicePdf(invoice.id)` and triggers a browser download
- Shows an empty state when no invoices; shows an error retry state on fetch failure
- Provides a status filter select (All / Paid / Pending / Failed / Refunded)

### 6. Update `Schools.tsx`

Six targeted changes to `Schools.tsx`:

**a. Remove subdomain from Profile tab** — remove the `["Subdomain", selected.subdomain ?? "—"]` entry from the detail array.

**b. Remove `recent_invoices` from `Tenant` type** — clean up the type.

**c. Replace Billing tab content** — swap the static `recent_invoices` render with `<TenantBillingTab tenantId={selected.id} />`.

**d. Fix suspend mutation `onSuccess`** — instead of `setSelected(null)`, update selected in-place:
```typescript
onSuccess: () => {
  setSelected((s) => s ? { ...s, status: 'suspended' } : s);
  qc.invalidateQueries({ queryKey: ['platform-tenants'] });
  toast.success('Tenant suspended');
},
```

**e. Fix reactivate mutation `onSuccess`** — same pattern, status → `'active'`.

**f. Replace `confirm()` delete with a Dialog** — add `deleteDialogOpen` and `deleteConfirmName` state; render a controlled Dialog that shows the refusal message when a 409 is returned, and requires name-typing before the final delete button is enabled.

---

## Verification checklist

### Gap 1 — Subdomain removed
- [ ] Open any tenant detail sheet → Profile tab → no "Subdomain" row appears
- [ ] Inspect network response for `GET /tenants/:id` — `subdomain` is still in the JSON (expected), just not rendered

### Gap 2 — Delete safeguard extended
- [ ] Attempt to delete a tenant that has at least one `subscription_invoices` record → receives 409 with message about financial records
- [ ] Attempt to delete a tenant that has at least one `billing_events` record → receives 409
- [ ] Attempt to delete a clean tenant (no records in any of the four tables) → dialog opens, name confirmation required, deletion succeeds after typing exact name

### Gap 3 — Suspend/Reactivate state sync
- [ ] Suspend an active tenant → sheet stays open → status badge changes to "Suspended" → Danger tab button changes to "Reactivate"
- [ ] Reactivate → status badge changes to "Active" → Danger tab button changes to "Suspend"
- [ ] Navigate back to list → row status reflects the change

### Gap 4 — Billing tab invoice listing
- [ ] Open Billing tab for a tenant with invoices → full list shown (not limited to 5)
- [ ] Filter by status → list narrows correctly
- [ ] Empty state shown for a tenant with no invoices

### Gap 5 — Invoice PDF download
- [ ] Click download icon on any invoice row → browser downloads a PDF
- [ ] No impersonation token is used — verify in network tab that the `Authorization` header carries the platform-admin JWT
