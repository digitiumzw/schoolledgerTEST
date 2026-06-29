# Quickstart: Billing Plans Management

**Branch**: `026-billing-plans-management` | **Date**: 2026-04-12

---

## Prerequisites

- PHP 8.1+, Composer, MySQL running locally
- Node.js + npm/bun for the frontend
- Paynow sandbox credentials in `backend/.env`
- Git checkout on branch `026-billing-plans-management`

---

## 1. Backend — Run Migrations

```bash
cd backend
php spark migrate
```

This applies (in order):
1. `2026-04-12-100000_Create_subscription_invoices_table` — creates `subscription_invoices`
2. `2026-04-12-110000_Create_billing_events_table` — creates `billing_events`
3. `2026-04-12-120000_Deactivate_free_plan` — deactivates free plan row, renames `standard`→`starter` and `advanced`→`growth` IDs/names

---

## 2. Backend — Install PDF Dependency

```bash
cd backend
composer require dompdf/dompdf "^2.0"
```

---

## 3. Backend — Reseed Plans (dev environments only)

If starting from a fresh database, run the updated seeder:

```bash
cd backend
php spark db:seed SubscriptionPlanSeeder
```

This inserts only the three active paid plans (Starter, Growth, Enterprise). The free plan is not seeded.

---

## 4. Backend — Verify Invoice Storage Directory

```bash
mkdir -p backend/writable/invoices
chmod 775 backend/writable/invoices
```

PDFs are stored as `writable/invoices/{tenantId}/{invoiceId}.pdf`.

---

## 5. Frontend — Install Dependencies

```bash
cd frontend
npm install
# or: bun install
```

No new npm packages are required; all UI components use existing shadcn/ui primitives.

---

## 6. Start Dev Servers

```bash
# Terminal 1 — backend
cd backend && php spark serve

# Terminal 2 — frontend
cd frontend && npm run dev
```

---

## 7. Verify the Feature

### 7a. Check plans endpoint (free plan gone)
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/subscription/plans
# Expect: 3 plans — Starter, Growth, Enterprise. No "Free" plan.
```

### 7b. Test downgrade (student count guard)
1. Activate a Growth plan for a tenant with 280 students.
2. Attempt to downgrade to Starter (max 249 students).
3. Expect HTTP 422 with `downgrade_blocked: true`, `studentCount: 280`, `planLimit: 249`.

### 7c. Test invoice generation
1. Complete a Paynow sandbox payment.
2. Poll `GET /api/subscription/poll/:txId` — expect `paid: true`.
3. Call `GET /api/subscription/invoices` — expect one invoice entry.
4. Call `GET /api/subscription/invoices/:id/download` — expect PDF download.

### 7d. Test billing events
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/api/subscription/events?page=1&perPage=20"
# Expect: events array with payment_confirmed and plan_activated entries.
```

### 7e. Frontend smoke test
1. Navigate to `/billing`.
2. Confirm only 3 plan cards are shown (no Free).
3. Confirm "Upgrade" and "Downgrade" labels appear correctly relative to current plan.
4. Confirm Invoices section lists past invoices with a Download button.
5. Confirm Billing History shows labelled significant events only (no "pending", "cancelled", "superseded" noise rows).

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/app/Controllers/Api/SubscriptionController.php` | Extended: downgrade, invoice/events endpoints |
| `backend/app/Models/SubscriptionInvoiceModel.php` | New model |
| `backend/app/Models/BillingEventModel.php` | New model |
| `backend/app/Services/InvoiceService.php` | New: invoice creation + PDF generation |
| `backend/app/Services/BillingEventService.php` | New: write billing events |
| `backend/app/Database/Migrations/2026-04-12-100000_*` | New: subscription_invoices table |
| `backend/app/Database/Migrations/2026-04-12-110000_*` | New: billing_events table |
| `backend/app/Database/Migrations/2026-04-12-120000_*` | Data migration: deactivate free plan, rename IDs |
| `frontend/src/pages/Billing.tsx` | Refactored billing page |
| `frontend/src/components/subscription/InvoiceList.tsx` | New: invoice list with download |
| `frontend/src/components/subscription/BillingHistoryList.tsx` | New: significant-events history |
| `frontend/src/hooks/useSubscription.ts` | Extended: downgrade + invoice download |
| `frontend/src/api/api.ts` | Extended: getInvoices, downloadInvoice, getBillingEvents |
