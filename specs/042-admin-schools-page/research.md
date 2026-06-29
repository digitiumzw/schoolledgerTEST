# Research: Platform Admin Schools Page Redo

**Branch**: `042-admin-schools-page` | **Date**: 2026-04-26

All findings below are based on direct code inspection of the existing codebase. No external API research was required — all relevant infrastructure already exists.

---

## Finding 1: Subdomain field — scope and safe removal

**Question**: Where does `subdomain` appear in both the backend response and the frontend rendering, and is removing it from display safe?

**Decision**: Remove `subdomain` from display only (Profile tab row array in `Schools.tsx`). Do NOT remove it from the DB query — the field is a required column in the `tenants` table (`allowedFields` includes it, the `store()` method writes it, and uniqueness is validated against it). The `Tenant` TypeScript type currently includes `subdomain: string` — keep it in the type for internal use but never render it.

**Findings**:
- `TenantsController::index()` line 23 selects `t.subdomain` — this is fine; it just flows into the JS `Tenant` type but is never rendered in the list view.
- `TenantsController::show()` line 65 selects `t.subdomain` — same; it populates `selected.subdomain` used in the Profile tab at `Schools.tsx` line 423: `["Subdomain", selected.subdomain ?? "—"]`.
- The fix is a single-line removal from the Profile tab row array. No backend change needed.
- The `subdomain` field must remain in the `Tenant` type because `createTenant` still requires it from the Add School form.

**Rationale**: Removing a display row is the minimal change. The subdomain is an internal provisioning detail, not an operational signal for a platform admin.

---

## Finding 2: Delete safeguard gap — missing tables in check

**Question**: Does the backend `delete()` check cover all financial record types defined in the spec?

**Decision**: Extend the `delete()` check in `TenantsController.php` to also check `subscription_invoices` (confirmed `tenant_id` column) and `billing_events` (confirmed `tenant_id` column via migration `2026-04-12-110000_Create_billing_events_table.php`).

**Findings**:
- Current check (lines 193–198): only `payments` and `charges`.
- Spec definition of "financial records": invoices, charges, payments, billing events.
- `subscription_invoices` has a `tenant_id` column (confirmed in `FinanceController.php` usage and migration `2026-04-12-100000_Create_subscription_invoices_table.php`).
- `billing_events` has a `tenant_id` column (confirmed in migration `2026-04-12-110000`).
- The fix adds two additional `countAllResults()` checks before the delete executes.

**Rationale**: A tenant that has gone through any subscription lifecycle (even a trial that generated an invoice or a billing event) must not be silently deletable. The current gap means a tenant with invoices but no payments could be deleted.

---

## Finding 3: Delete confirmation — frontend pattern

**Question**: What is the correct UI pattern to replace the bare `confirm()` call?

**Decision**: Use a controlled `Dialog` (already imported from shadcn/ui in `Schools.tsx`) with a name-confirmation `Input`. The dialog is triggered from the Danger tab button. The confirm button is disabled until `inputValue === selected.name` exactly (case-sensitive).

**Findings**:
- `confirm()` is used in two places: the dropdown row action (line 364) and the Danger tab button (line 495). Both must be replaced.
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` are already imported in the file.
- `Input` and `Label` are already imported.
- A `useState` for `deleteDialogOpen` and `deleteConfirmName` is the minimal addition.
- The dialog should: (a) first call a pre-check endpoint or simply attempt the delete and handle the 409 error gracefully; (b) show the 409 refusal message inline in the dialog rather than as a toast, since it contains guidance ("suspend instead").

**Rationale**: The spec requires multi-step name confirmation (FR-032). shadcn/ui Dialog is the established pattern in this codebase. Handling the 409 inline in the dialog is better UX than closing the dialog and showing a toast.

---

## Finding 4: Suspend/Reactivate — state sync approach

**Question**: Should the detail sheet stay open or close on suspend/reactivate, and how should the status update?

**Decision**: Keep the detail sheet open. On success, update the `selected` state in-place with the new status (optimistic/confirmed update) rather than calling `setSelected(null)`. Invalidate the tenant list query in the background so the list row also updates when the user closes the sheet.

**Findings**:
- Current `suspendMut.onSuccess`: `setSelected(null)` — sheet closes, no confirmation visible.
- Current `reactivateMut.onSuccess`: same.
- The Danger tab correctly reads `selected.status` to toggle between "Suspend" and "Reactivate" buttons (line 471, 480), so updating `selected` in-place will immediately flip the button and the status badge.
- The `StatusBadge` component reads `selected.status` from the sheet header (line 406), so it updates automatically.
- `qc.invalidateQueries` on the tenant list is still needed so the list row reflects the change.

**Rationale**: Keeping the sheet open with the updated status gives the admin immediate confirmation that the action succeeded without losing their context. Closing the sheet was a UX bug.

---

## Finding 5: Billing tab — invoice listing and PDF download

**Question**: What is the most correct approach to fetch per-tenant invoices with status and enable PDF download?

**Decision**: Add a new backend endpoint `GET /tenants/:id/invoices` that returns paginated, filterable invoices for a single tenant (reusing the existing `FinanceController` invoice query pattern but scoped to one tenant). Fetch lazily in a new `TenantBillingTab` component using React Query, keyed to the tenant ID, only when the Billing tab is active. PDF download uses the existing `GET /finance/invoices/:id/pdf` endpoint via `downloadInvoicePdf()` from `platform.ts`.

**Findings**:
- The existing `show()` embeds `recent_invoices` (5 max, no status join) — insufficient for a full billing view.
- `FinanceController::invoices()` already supports `?tenant_id=` filter and returns `payment_status` — this is the right query pattern to replicate.
- `FinanceController::invoicePdf($id)` already exists, is platform-admin–authenticated (`canViewFinance` check), and returns a PDF blob. The frontend `downloadInvoicePdf()` function in `platform.ts` already wraps this endpoint and handles blob responses (the `request()` function returns `await res.blob()` for non-JSON content types).
- The `canViewFinance` check in `PlatformPolicy` allows Owner, Admin, Finance, and Support roles (all roles can view finance per the role matrix), so no role barrier.
- Adding a new endpoint on `TenantsController` (rather than reusing `FinanceController::invoices` with a filter) keeps the tenant resource self-contained and avoids the caller needing Finance role just to view one tenant's invoices.

**Rationale**: A dedicated `tenantInvoices($id)` method on `TenantsController` is minimal, consistent with REST resource nesting (`/tenants/:id/invoices`), and avoids coupling the tenant detail view to the Finance permission check.

---

## Finding 6: Invoice status display

**Question**: Why is invoice status missing from the current Billing tab, and how to fix it?

**Decision**: The new `tenantInvoices()` endpoint must join `subscription_payment_transactions` on `transaction_id` to derive `payment_status`, matching the pattern in `FinanceController::invoices()`. The frontend `TenantBillingTab` component renders a `StatusBadge` for each invoice's `payment_status`.

**Findings**:
- `TenantsController::show()` fetches `recent_invoices` from `subscription_invoices` without joining `subscription_payment_transactions`. The `payment_status` field is absent.
- `FinanceController::invoices()` (lines 64–68) correctly joins `subscription_payment_transactions spt` on `si.transaction_id` to derive `spt.status AS payment_status`.
- The `StatusBadge` component already has variants for `paid`, `pending`, `failed`, `refunded` (lines 18–22 of `StatusBadge.tsx`).

**Rationale**: Copying the same join pattern from `FinanceController` is the correct, consistent approach.

---

## Summary of Changes Required

| Area | Change | Type |
|------|--------|------|
| `TenantsController::delete()` | Add `subscription_invoices` and `billing_events` checks | Backend extend |
| `TenantsController` | Add `tenantInvoices($id)` method | Backend new method |
| `Routes.php` | Add `GET tenants/(:segment)/invoices` | Backend new route |
| `Schools.tsx` — Profile tab | Remove "Subdomain" row from detail array | Frontend fix |
| `Schools.tsx` — Danger tab (delete) | Replace `confirm()` with Dialog + name confirmation | Frontend fix |
| `Schools.tsx` — suspend/reactivate mutations | On success: update `selected` in-place instead of `setSelected(null)` | Frontend fix |
| `TenantBillingTab.tsx` | New component: per-tenant invoice list + status + PDF download | Frontend new |
| `Schools.tsx` — Billing tab | Replace static `recent_invoices` render with `<TenantBillingTab>` | Frontend wire |
| `platform.ts` | Add `getTenantInvoices(tenantId)` function | Frontend API |
| `TenantsControllerTest.php` | Integration tests for extended delete safeguard | Backend tests |
